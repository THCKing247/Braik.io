import { executeStoredProposal } from "@/lib/braik-ai/execute-confirmed-proposal"
import type { SchedulingResolutionContext } from "@/lib/braik-ai/resolve-scheduling-slots"
import {
  findLatestPendingProposalForUserTeam,
  getProposal,
  markRejected,
} from "@/lib/braik-ai/action-proposal-store"

/** Used with explicit activeProposalId from the client (phrase can start a longer message). */
const CONFIRM_RE = /^(yes|yeah|yep|sure|ok|okay|send it|confirm|go ahead|do it)\b/i
const REJECT_RE = /^(no|nope|nah|cancel|stop|never mind|don'?t|skip)\b/i
/** Without proposal id, only match standalone phrases to avoid confirming on “yes, and also…”. */
const STRICT_CONFIRM = /^(yes|yeah|yep|sure|ok|okay|send it|confirm|go ahead|do it)(\s*[!.])?$/i
const STRICT_REJECT = /^(no|nope|nah|cancel|stop|never mind|don'?t|skip)(\s*[!.])?$/i

export { CONFIRM_RE, REJECT_RE }

export type PendingConfirmationResolved =
  | { handled: true; kind: "executed"; response: string; result?: Record<string, unknown> }
  | { handled: true; kind: "failed"; response: string }
  | { handled: true; kind: "cancelled"; response: string }
  | { handled: false }

/**
 * Routes confirmation/rejection phrases to stored pending tool proposals (DB-backed).
 * Does not send confirmation text through the LLM — execution uses structured proposal state only.
 */
export async function resolvePendingConfirmationTurn(params: {
  message: string
  teamId: string | undefined
  sessionUserId: string
  confirmProposalId: string | null | undefined
  idempotencyKey: string | null | undefined
  incomingRequest: Request | null
  schedulingContext?: SchedulingResolutionContext | null
}): Promise<PendingConfirmationResolved> {
  const { message, teamId, sessionUserId, confirmProposalId, idempotencyKey, incomingRequest, schedulingContext } =
    params
  const trimmed = message.trim()

  let proposalId = typeof confirmProposalId === "string" ? confirmProposalId.trim() : ""
  const isConfirm = CONFIRM_RE.test(trimmed)
  const isReject = REJECT_RE.test(trimmed)

  if (!isConfirm && !isReject) {
    return { handled: false }
  }

  if (!proposalId && teamId) {
    const strictOk = isConfirm ? STRICT_CONFIRM.test(trimmed) : STRICT_REJECT.test(trimmed)
    if (strictOk) {
      const latest = await findLatestPendingProposalForUserTeam(sessionUserId, teamId)
      if (latest) {
        proposalId = latest.id
        console.log("[Coach B pending resolver] resolved standalone phrase to latest pending proposal", {
          proposalId,
          actionType: latest.actionType,
          teamId,
          phrase: isConfirm ? "confirm" : "reject",
        })
      }
    }
  }

  if (!proposalId) {
    console.log("[Coach B pending resolver] confirm/reject phrase but no proposal id and no team pending", {
      teamId: teamId ?? null,
      isConfirm,
      isReject,
    })
    return { handled: false }
  }

  const pending = await getProposal(proposalId)
  if (!pending || pending.userId !== sessionUserId) {
    console.warn("[Coach B pending resolver] proposal missing or wrong user", {
      proposalId,
      hasPending: Boolean(pending),
    })
    return {
      handled: true,
      kind: "cancelled",
      response:
        "That approval request expired or was already handled. Send the request again if you still need it.",
    }
  }

  if (isReject) {
    console.log("[Coach B pending resolver] confirmation received (reject)", { proposalId, actionType: pending.actionType })
    await markRejected(proposalId)
    return {
      handled: true,
      kind: "cancelled",
      response: "Got it — I cancelled that action. Tell me what you’d like to do next.",
    }
  }

  console.log("[Coach B pending resolver] confirmation matched to pending action — executing", {
    proposalId,
    actionType: pending.actionType,
    teamId: pending.teamId,
  })

  const exec = await executeStoredProposal(proposalId, {
    idempotencyKey,
    incomingRequest,
    schedulingContext: schedulingContext ?? null,
  })

  if (!exec.success) {
    console.error("[Coach B pending resolver] execution failed", {
      proposalId,
      message: exec.message,
    })
    return {
      handled: true,
      kind: "failed",
      response: exec.message ?? "That action could not be completed. Please try again or use the Confirm button.",
    }
  }

  console.log("[Coach B pending resolver] execution succeeded", {
    proposalId,
    executed: exec.executed ?? null,
  })

  return {
    handled: true,
    kind: "executed",
    response: exec.message ?? "Done.",
    result: exec.executed,
  }
}
