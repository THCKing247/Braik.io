/**
 * In-memory pending AI action proposals (confirmation before execution).
 * Serverless note: proposals survive only for the lifetime of the Node process; use sticky sessions or DB for multi-instance production.
 */

import { randomUUID } from "crypto"

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
const store = new Map<string, StoredProposal>()

export function createProposal(entry: Omit<StoredProposal, "id" | "status" | "createdAt">): StoredProposal {
  pruneExpired()
  const id = randomUUID()
  const row: StoredProposal = {
    ...entry,
    id,
    status: "pending",
    createdAt: new Date().toISOString(),
  }
  store.set(id, row)
  return row
}

export function getProposal(id: string): StoredProposal | undefined {
  pruneExpired()
  const p = store.get(id)
  if (!p) return undefined
  if (Date.now() - new Date(p.createdAt).getTime() > TTL_MS) {
    store.delete(id)
    return undefined
  }
  return p
}

export function markExecuted(id: string): void {
  const p = store.get(id)
  if (p) store.set(id, { ...p, status: "executed" })
}

export function markRejected(id: string): void {
  const p = store.get(id)
  if (p) store.set(id, { ...p, status: "rejected" })
}

function pruneExpired(): void {
  const now = Date.now()
  for (const [k, v] of store.entries()) {
    if (now - new Date(v.createdAt).getTime() > TTL_MS) store.delete(k)
  }
}
