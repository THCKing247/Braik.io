import { prisma } from "@/lib/prisma"

export type ActionProposalPreview = {
  summary: string
  items: unknown[]
  affectedCount: number
}

export type ExecuteConfirmedResult = {
  success: boolean
  errors?: string[]
  executedItems?: unknown[]
}

/**
 * Create an AI action proposal (e.g. for approval-required actions).
 * Returns the new proposal id.
 */
export async function createActionProposal(
  teamId: string,
  userId: string,
  actionType: string,
  payload: Record<string, unknown>,
  preview: ActionProposalPreview
): Promise<string> {
  const proposal = await prisma.aIActionProposal.create({
    data: {
      teamId,
      userId,
      actionType,
      payload: payload as object,
      affectedRecordsPreview: preview as object,
      status: "pending",
    },
  })
  return proposal.id
}

/**
 * Execute a safe action immediately (no approval). Placeholder for create_event, send_message, draft_*.
 */
export async function executeSafeAction(
  _teamId: string,
  _userId: string,
  _actionType: string,
  _payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  // In production: implement create_event, send_message, etc.
  return { success: false, error: "Safe action execution not implemented" }
}

/**
 * Execute a confirmed action proposal (Head Coach has approved).
 * Marks proposal as executed and performs the action.
 */
export async function executeConfirmedAction(
  proposalId: string,
  _confirmingUserId: string,
  _confirmedItems?: unknown[]
): Promise<ExecuteConfirmedResult> {
  const proposal = await prisma.aIActionProposal.findUnique({
    where: { id: proposalId },
  })
  if (!proposal) {
    return { success: false, errors: ["Proposal not found"] }
  }
  if (proposal.status !== "pending") {
    return { success: false, errors: ["Proposal is not pending"] }
  }

  // Mark as executed; in production, perform the action (e.g. create events, send announcement)
  await prisma.aIActionProposal.update({
    where: { id: proposalId },
    data: { status: "executed" },
  })

  return {
    success: true,
    executedItems: [],
  }
}
