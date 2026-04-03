/**
 * Pending AI action proposals (confirmation before execution).
 *
 * Persists to `coach_b_action_proposals` so confirmations work across serverless
 * instances (in-memory alone fails when create and confirm hit different Lambdas).
 * A same-process memory cache is still updated for fast reads on the warm instance.
 */

import { randomUUID } from "crypto"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type ProposalActionType =
  | "move_player_depth_chart"
  | "send_team_message"
  | "send_notification"
  | "create_event"

export interface StoredProposal {
  id: string
  teamId: string
  userId: string
  actionType: ProposalActionType
  /** JSON-serializable payload validated on confirm */
  payload: unknown
  preview: {
    summary: string
    items: unknown[]
    affectedCount: number
  }
  status: "pending" | "executed" | "rejected"
  createdAt: string
  /** Source for voice vs text policy */
  inputSource: "text" | "voice"
  idempotencyKey?: string | null
}

const TTL_MS = 60 * 60 * 1000
/** Warm-instance cache; always mirrored on write. DB is source of truth across instances. */
const memoryCache = new Map<string, StoredProposal>()

type DbProposalRow = {
  id: string
  team_id: string
  user_id: string
  action_type: string
  payload: unknown
  preview: unknown
  status: string
  input_source: string
  idempotency_key: string | null
  created_at: string
}

function rowToStored(r: DbProposalRow): StoredProposal {
  const preview = r.preview as StoredProposal["preview"]
  return {
    id: r.id,
    teamId: r.team_id,
    userId: r.user_id,
    actionType: r.action_type as ProposalActionType,
    payload: r.payload,
    preview,
    status: r.status as StoredProposal["status"],
    createdAt: r.created_at,
    inputSource: r.input_source === "voice" ? "voice" : "text",
    idempotencyKey: r.idempotency_key,
  }
}

function pruneMemoryExpired(): void {
  const now = Date.now()
  for (const [k, v] of memoryCache.entries()) {
    if (now - new Date(v.createdAt).getTime() > TTL_MS) memoryCache.delete(k)
  }
}

export async function createProposal(
  entry: Omit<StoredProposal, "id" | "status" | "createdAt">
): Promise<StoredProposal> {
  pruneMemoryExpired()
  const id = randomUUID()
  const row: StoredProposal = {
    ...entry,
    id,
    status: "pending",
    createdAt: new Date().toISOString(),
  }
  memoryCache.set(id, row)

  const supabase = getSupabaseServer()
  const { error } = await supabase.from("coach_b_action_proposals").insert({
    id: row.id,
    team_id: row.teamId,
    user_id: row.userId,
    action_type: row.actionType,
    payload: row.payload as object,
    preview: row.preview as object,
    status: row.status,
    input_source: row.inputSource,
    idempotency_key: row.idempotencyKey ?? null,
    created_at: row.createdAt,
    updated_at: row.createdAt,
  })

  if (error) {
    console.error("[coach_b_action_proposals] insert failed (memory cache still holds proposal)", {
      code: error.code,
      message: error.message,
      proposalId: id,
    })
  } else {
    console.log("[coach_b_action_proposals] pending action stored", {
      proposalId: id,
      actionType: row.actionType,
      teamId: row.teamId,
      userId: row.userId,
    })
  }

  return row
}

export async function getProposal(id: string): Promise<StoredProposal | undefined> {
  pruneMemoryExpired()
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from("coach_b_action_proposals")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle()

  if (!error && data) {
    const stored = rowToStored(data as DbProposalRow)
    if (Date.now() - new Date(stored.createdAt).getTime() > TTL_MS) {
      return undefined
    }
    memoryCache.set(id, stored)
    return stored
  }

  if (error) {
    console.warn("[coach_b_action_proposals] select by id failed, trying memory", {
      proposalId: id,
      message: error.message,
    })
  }

  const mem = memoryCache.get(id)
  if (!mem) return undefined
  if (Date.now() - new Date(mem.createdAt).getTime() > TTL_MS) {
    memoryCache.delete(id)
    return undefined
  }
  return mem.status === "pending" ? mem : undefined
}

/** Latest pending proposal for user+team (e.g. client lost activeProposalId). */
export async function findLatestPendingProposalForUserTeam(
  userId: string,
  teamId: string
): Promise<StoredProposal | undefined> {
  pruneMemoryExpired()
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from("coach_b_action_proposals")
    .select("*")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!error && data) {
    const stored = rowToStored(data as DbProposalRow)
    if (Date.now() - new Date(stored.createdAt).getTime() > TTL_MS) {
      return undefined
    }
    memoryCache.set(stored.id, stored)
    return stored
  }

  if (error) {
    console.warn("[coach_b_action_proposals] findLatest failed", { message: error.message, userId, teamId })
  }

  let latest: StoredProposal | undefined
  let latestTs = 0
  for (const p of memoryCache.values()) {
    if (p.userId !== userId || p.teamId !== teamId || p.status !== "pending") continue
    const ts = new Date(p.createdAt).getTime()
    if (ts > latestTs && Date.now() - ts <= TTL_MS) {
      latestTs = ts
      latest = p
    }
  }
  return latest
}

export async function markExecuted(id: string): Promise<void> {
  const supabase = getSupabaseServer()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("coach_b_action_proposals")
    .update({ status: "executed", updated_at: now })
    .eq("id", id)

  if (error) {
    console.error("[coach_b_action_proposals] markExecuted failed", { proposalId: id, message: error.message })
  } else {
    console.log("[coach_b_action_proposals] pending action cleared (executed)", { proposalId: id })
  }

  const mem = memoryCache.get(id)
  if (mem) memoryCache.set(id, { ...mem, status: "executed" })
}

export async function markRejected(id: string): Promise<void> {
  const supabase = getSupabaseServer()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("coach_b_action_proposals")
    .update({ status: "rejected", updated_at: now })
    .eq("id", id)

  if (error) {
    console.error("[coach_b_action_proposals] markRejected failed", { proposalId: id, message: error.message })
  } else {
    console.log("[coach_b_action_proposals] pending action cleared (rejected)", { proposalId: id })
  }

  const mem = memoryCache.get(id)
  if (mem) memoryCache.set(id, { ...mem, status: "rejected" })
}
