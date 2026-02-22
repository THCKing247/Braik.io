import type { PrismaClient } from "@prisma/client"

/** Billing/account status used for permission checks (e.g. AI access). */
export type BillingState = {
  status: "ACTIVE" | "GRACE" | "READ_ONLY" | "LOCKED"
  canUseAI?: boolean
}

/**
 * Ensures the team (or its account) has permission for the given capability (e.g. "useAI").
 * Respects account status: ACTIVE and GRACE allow use; READ_ONLY and LOCKED deny.
 * Returns the current billing state; throws or returns a response only if the caller
 * is expected to abort (e.g. 403). For now, with no billing model in schema, all teams
 * are treated as ACTIVE and allowed.
 */
export async function requireBillingPermission(
  _teamId: string,
  permission: string,
  _prisma: PrismaClient
): Promise<BillingState> {
  // When billing/subscription is added (e.g. Team.accountStatus or Subscription table),
  // check status here and throw or return 403 for READ_ONLY / LOCKED.
  if (permission === "useAI") {
    return { status: "ACTIVE", canUseAI: true }
  }
  return { status: "ACTIVE" }
}
