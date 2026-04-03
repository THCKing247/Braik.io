import { buildContext } from "@/lib/braik-ai/context-builder"
import { runCoordinatorTool } from "@/lib/braik-ai/coordinator-tools"
import { detectFollowUp, getLastUserMessage, resolveFollowUpContext } from "@/lib/braik-ai/follow-up"
import { buildCoachBPrompt, createGenericContext } from "@/lib/braik-ai/prompt-builder"
import { sendCoachBPrompt, isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import { buildCoachBToolMessages, runCoachBToolCompletion } from "@/lib/braik-ai/coach-b-openai-tools"
import { processCoachBToolMessage, type ToolHandlerResult } from "@/lib/braik-ai/coach-b-tool-execution"
import { executeStoredProposal } from "@/lib/braik-ai/execute-confirmed-proposal"
import type { SessionUser } from "@/lib/auth/server-auth"
import { MembershipLookupError, profileRoleToNormalizedRole } from "@/lib/auth/rbac"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

const CONFIRM_RE = /^(yes|yeah|yep|send it|confirm|go ahead|do it)\b/i

export type CoachBChatResult =
  | { type: "response"; response: string; usage?: undefined; usageStatus?: undefined }
  | {
      type: "action_proposal"
      message: string
      proposalId: string
      actionType: string
      preview?: { summary: string; items: unknown[]; affectedCount: number }
    }
  | { type: "action_executed"; response: string; result?: Record<string, unknown> }
  | { type: "error"; message: string; status?: number }

function mapToolResult(t: ToolHandlerResult): CoachBChatResult {
  if (t.type === "response") {
    return { type: "response", response: t.response }
  }
  if (t.type === "action_proposal") {
    return {
      type: "action_proposal",
      message: t.message,
      proposalId: t.proposalId,
      actionType: t.actionType,
      preview: t.preview,
    }
  }
  return { type: "action_executed", response: t.message, result: t.result }
}

export interface RunCoachBChatParams {
  message: string
  teamId?: string
  sessionUser: SessionUser
  conversationHistory: Array<{ role: string; content: string }>
  /** text vs voice — affects create_event confirmation policy */
  inputSource?: "text" | "voice"
  confirmProposalId?: string | null
  idempotencyKey?: string | null
  /** When true, attempt OpenAI tool calling before fallback chat */
  enableActionTools?: boolean
}

/**
 * Shared Coach B pipeline: context → tools (optional) → OpenAI text fallback.
 * Used by /api/ai/chat and /api/ai/voice after transcription.
 */
export async function runCoachBChat(params: RunCoachBChatParams): Promise<CoachBChatResult> {
  if (!isOpenAIConfigured()) {
    return { type: "error", message: "OPENAI_API_KEY is not configured", status: 500 }
  }

  const message = params.message.trim()
  if (!message) {
    return { type: "error", message: "message must be a non-empty string", status: 400 }
  }

  const teamId = params.teamId?.trim() || undefined
  let viewerRoleLabel: string | undefined

  if (teamId) {
    try {
      const { membership } = await requireTeamAccess(teamId)
      if (!canUseCoachB(membership.role as Role)) {
        return { type: "error", message: "Coach B is only available to coaching and admin roles.", status: 403 }
      }
      viewerRoleLabel = membership.role
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (err instanceof MembershipLookupError) {
        console.error("[runCoachBChat] membership lookup failed", err)
        return { type: "error", message: "Failed to verify team access", status: 500 }
      }
      if (msg.includes("Access denied") || msg.includes("Not a member")) {
        return { type: "error", message: "You do not have access to this team.", status: 403 }
      }
      throw err
    }
  } else {
    const supabase = getSupabaseServer()
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", params.sessionUser.id).maybeSingle()
    const r = profileRoleToNormalizedRole((prof as { role?: string } | null)?.role)
    if (!canUseCoachB(r as Role)) {
      return { type: "error", message: "Coach B is only available to coaching and admin roles.", status: 403 }
    }
    viewerRoleLabel = r
  }

  const inputSource = params.inputSource ?? "text"

  if (params.confirmProposalId?.trim() && CONFIRM_RE.test(message)) {
    const pid = params.confirmProposalId.trim()
    console.log("[Coach B] confirmation phrase for proposal", { proposalId: pid, userId: params.sessionUser.id })
    const exec = await executeStoredProposal(pid, { idempotencyKey: params.idempotencyKey })
    if (!exec.success) {
      return { type: "response", response: exec.message ?? "Could not complete that action." }
    }
    return { type: "action_executed", response: exec.message ?? "Action completed.", result: exec.executed }
  }

  const history = Array.isArray(params.conversationHistory) ? params.conversationHistory : []
  let context = createGenericContext()
  if (teamId) {
    try {
      const result = await buildContext(teamId, message)
      if (result) {
        let resolvedContext = result.context
        if (detectFollowUp(message, history)) {
          const lastUserMsg = getLastUserMessage(history)
          if (lastUserMsg) {
            const priorResult = await buildContext(teamId, lastUserMsg)
            if (priorResult) {
              resolvedContext = resolveFollowUpContext(message, history, result.context, priorResult.context)
            }
          }
        }
        context = resolvedContext
      } else {
        context = createGenericContext(["Braik context could not be loaded."])
      }
    } catch (err) {
      console.error("[runCoachBChat] context build failed", err)
      context = createGenericContext(["Context build failed; answering from general knowledge."])
    }
  }

  const coordinatorAnalysis = runCoordinatorTool(context, message)
  const prompt = buildCoachBPrompt({
    context,
    message,
    history,
    coordinatorAnalysis,
    role: viewerRoleLabel,
    enableActionTools: Boolean(params.enableActionTools && teamId),
  })

  trackProductEventServer({
    eventName: BRAIK_EVENTS.coach_b.prompt_submitted,
    eventCategory: "coach_b",
    userId: params.sessionUser.id,
    teamId: teamId ?? null,
    role: viewerRoleLabel ?? null,
    metadata: {
      domain: context.domain,
      intent: context.intent,
      coordinator_tool: coordinatorAnalysis?.tool ?? null,
      input_source: inputSource,
    },
  })

  const useTools = Boolean(params.enableActionTools && teamId)
  if (useTools) {
    try {
      const toolMessages = buildCoachBToolMessages(prompt.instructions, prompt.input)
      const { message: assistantMsg } = await runCoachBToolCompletion(toolMessages)
      const toolCtx = {
        teamId: teamId!,
        sessionUser: params.sessionUser,
        inputSource,
      }
      const handled = await processCoachBToolMessage(assistantMsg, toolCtx)
      if (handled) {
        const emptyTextResponse = handled.type === "response" && !handled.response.trim()
        if (!emptyTextResponse) {
          trackProductEventServer({
            eventName: BRAIK_EVENTS.coach_b.response_completed,
            eventCategory: "coach_b",
            userId: params.sessionUser.id,
            teamId: teamId ?? null,
            role: viewerRoleLabel ?? null,
            metadata: { domain: context.domain, intent: context.intent, coach_b_tools: true },
          })
          return mapToolResult(handled)
        }
      }
      if (assistantMsg.content?.trim()) {
        trackProductEventServer({
          eventName: BRAIK_EVENTS.coach_b.response_completed,
          eventCategory: "coach_b",
          userId: params.sessionUser.id,
          teamId: teamId ?? null,
          role: viewerRoleLabel ?? null,
          metadata: { domain: context.domain, intent: context.intent },
        })
        return { type: "response", response: assistantMsg.content.trim() }
      }
    } catch (e) {
      console.warn("[runCoachBChat] tool path failed, falling back to text-only", e)
    }
  }

  try {
    const text = await sendCoachBPrompt(prompt.instructions, prompt.input)
    trackProductEventServer({
      eventName: BRAIK_EVENTS.coach_b.response_completed,
      eventCategory: "coach_b",
      userId: params.sessionUser.id,
      teamId: teamId ?? null,
      role: viewerRoleLabel ?? null,
      metadata: { domain: context.domain, intent: context.intent },
    })
    return { type: "response", response: text }
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err)
    console.error("[runCoachBChat] OpenAI failed", details)
    trackProductEventServer({
      eventName: BRAIK_EVENTS.coach_b.response_error,
      eventCategory: "coach_b",
      userId: params.sessionUser.id,
      teamId: teamId ?? null,
      role: viewerRoleLabel ?? null,
      metadata: { domain: context.domain, intent: context.intent },
    })
    return { type: "error", message: "AI chat failed", status: 500 }
  }
}
