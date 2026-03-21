import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * Canonical audit row shape (matches migration 20260348000000_audit_logs_normalize.sql).
 * DB column `actor_id` holds the acting user id (docs may say "actor_user_id").
 */
export interface WriteAuditLogInput {
  actorUserId: string
  teamId?: string | null
  actionType: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Insert into `audit_logs`. Tries the normalized shape first, then legacy shapes if the DB predates migrations.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServer()
  const meta = input.metadata ?? null

  const base = {
    actor_id: input.actorUserId,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
  }

  const withTeam =
    input.teamId != null && input.teamId !== ""
      ? { ...base, team_id: input.teamId }
      : base

  const tryNormalized = await supabase.from("audit_logs").insert({
    ...withTeam,
    action_type: input.actionType,
    metadata_json: meta,
  })

  if (!tryNormalized.error) {
    return { ok: true }
  }

  const err1 = tryNormalized.error.message ?? ""

  // New rows without team_id column
  const noTeam = await supabase.from("audit_logs").insert({
    ...base,
    action_type: input.actionType,
    metadata_json: meta,
  })
  if (!noTeam.error) {
    return { ok: true }
  }

  // Legacy: action + metadata (60225)
  const legacy1 = await supabase.from("audit_logs").insert({
    ...base,
    action: input.actionType,
    metadata: meta,
  } as Record<string, unknown>)
  if (!legacy1.error) {
    return { ok: true }
  }

  // Legacy: action_type + metadata (no metadata_json)
  const legacy2 = await supabase.from("audit_logs").insert({
    ...withTeam,
    action_type: input.actionType,
    metadata: meta,
  } as Record<string, unknown>)
  if (!legacy2.error) {
    return { ok: true }
  }

  console.error("[writeAuditLog] all insert strategies failed", {
    actionType: input.actionType,
    firstError: err1,
    lastError: legacy2.error?.message,
  })
  return { ok: false, error: tryNormalized.error.message }
}
