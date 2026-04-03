import { buildContext } from "@/lib/braik-ai/context-builder"
import { runCoordinatorTool } from "@/lib/braik-ai/coordinator-tools"
import { detectFollowUp, getLastUserMessage, resolveFollowUpContext } from "@/lib/braik-ai/follow-up"
import { buildCoachBPrompt, createGenericContext } from "@/lib/braik-ai/prompt-builder"
import { sendCoachBPrompt, isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import { buildCoachBToolMessages, runCoachBToolCompletion } from "@/lib/braik-ai/coach-b-openai-tools"
import { processCoachBToolMessage, type ToolHandlerResult } from "@/lib/braik-ai/coach-b-tool-execution"
import type { SessionUser } from "@/lib/auth/server-auth"
import { MembershipLookupError, profileRoleToNormalizedRole } from "@/lib/auth/rbac"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"
import { resolveVoiceModeFromInput } from "@/lib/braik-ai/resolve-voice-mode"
import { resolveCoachBVoiceProfile } from "@/lib/braik-ai/resolve-coach-b-voice-profile"
import type { CoachBVoiceRequestFields } from "@/lib/braik-ai/coach-b-voice-request"
import { resolvePendingConfirmationTurn } from "@/lib/braik-ai/pending-action-resolver"
import { deriveDefaultSpokenText } from "@/lib/braik-ai/coach-b-spoken-text"
import {
  isLikelyCalendarSchedulingRequest,
  isLooseCalendarSchedulingHint,
} from "@/lib/braik-ai/scheduling-intent"

const SCHEDULING_FORCE_SUFFIX = `\n\n[Scheduling] The user is putting a dated item on the team calendar (practice, workout, meeting, etc.). Call create_event with title, start_iso, end_iso, event_type, and location when given. Parse times from their message into ISO 8601. Do not use send_notification or send_team_message for this turn. After the event is saved, the app confirms; you may briefly offer to notify players or parents as a follow-up only.`

export type CoachBChatResult =
  | {
      type: "response"
      response: string
      spokenText?: string
      usage?: undefined
      usageStatus?: undefined
      clearActiveProposal?: boolean
    }
  | {
      type: "action_proposal"
      message: string
      proposalId: string
      actionType: string
      preview?: { summary: string; items: unknown[]; affectedCount: number }
    }
  | { type: "action_executed"; response: string; result?: Record<string, unknown>; spokenText?: string }
  | { type: "error"; message: string; status?: number }

function mapToolResult(t: ToolHandlerResult): CoachBChatResult {
  if (t.type === "response") {
    const st = t.spokenText ?? deriveDefaultSpokenText(t.response)
    return { type: "response", response: t.response, spokenText: st }
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
  const st = t.spokenText ?? deriveDefaultSpokenText(t.message)
  return { type: "action_executed", response: t.message, result: t.result, spokenText: st }
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
  /** Forwarded to proposal execution so create_event can call the calendar API with the user’s cookies. */
  incomingRequest?: Request | null
  /** Coach B Voice OS: personality, sideline, memory, voice command metadata. */
  coachVoice?: CoachBVoiceRequestFields | null
}

function buildCoachVoicePromptSuffix(cv: CoachBVoiceRequestFields | null | undefined): string | null {
  if (!cv) return null
  const mode = resolveVoiceModeFromInput({
    page: cv.page,
    action: cv.action,
    intent: cv.intent,
    isLiveGame: cv.isLiveGame,
    isPractice: cv.isPractice,
    isMessaging: cv.isMessaging,
    isSidelineModeEnabled: cv.sidelineMode,
    manualModeOverride: cv.voiceModeOverride ?? null,
  })
  const profile = resolveCoachBVoiceProfile({
    userPreferences: cv.userVoiceMemory ?? null,
    teamPreferences: cv.teamVoiceMemory ?? null,
    selectedPersonality: cv.personalityId ?? null,
    personalityOverride: cv.personalityOverride ?? null,
    selectedMode: mode,
    currentContext: {
      page: cv.page,
      action: cv.action,
      intent: cv.intent,
      isMessagingSurface: cv.isMessaging,
      isOffensePlayQuestion:
        cv.voiceCommand?.intentType === "recommendation" ||
        cv.intent === "game_strategy" ||
        cv.page === "playbooks",
    },
  })

  console.log("[Coach B Voice]", {
    personality: profile.personality,
    personalityLabel: profile.personalityLabel,
    voiceMode: mode,
    sidelineMode: Boolean(cv.sidelineMode),
    voiceCommandIntent: cv.voiceCommand?.intentType ?? null,
    voiceCommandAction: cv.voiceCommand?.actionName ?? null,
  })

  const parts: string[] = [
    "--- Coach B voice profile (delivery) ---",
    profile.textResponseRules,
  ]
  if (cv.sidelineMode) {
    parts.push(
      "Sideline mode: Keep the answer to one short sentence for the main point unless the user explicitly asks for more detail.",
    )
  }
  if (cv.voiceCommand?.intentType === "recommendation") {
    parts.push(
      "Voice intent: tactical recommendation — state the call or read first, then at most one or two short football reasons.",
    )
  }
  return parts.join("\n")
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

  const pendingTurn = await resolvePendingConfirmationTurn({
    message,
    teamId,
    sessionUserId: params.sessionUser.id,
    confirmProposalId: params.confirmProposalId,
    idempotencyKey: params.idempotencyKey,
    incomingRequest: params.incomingRequest ?? null,
  })
  if (pendingTurn.handled) {
    if (pendingTurn.kind === "executed") {
      return {
        type: "action_executed",
        response: pendingTurn.response,
        result: pendingTurn.result,
        spokenText: deriveDefaultSpokenText(pendingTurn.response),
      }
    }
    if (pendingTurn.kind === "failed") {
      return {
        type: "response",
        response: pendingTurn.response,
        spokenText: deriveDefaultSpokenText(pendingTurn.response),
      }
    }
    if (pendingTurn.kind === "cancelled") {
      return {
        type: "response",
        response: pendingTurn.response,
        clearActiveProposal: true,
        spokenText: deriveDefaultSpokenText(pendingTurn.response),
      }
    }
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
  const coachVoicePromptSuffix = buildCoachVoicePromptSuffix(params.coachVoice ?? null)
  const prompt = buildCoachBPrompt({
    context,
    message,
    history,
    coordinatorAnalysis,
    role: viewerRoleLabel,
    enableActionTools: Boolean(params.enableActionTools && teamId),
    coachVoicePromptSuffix,
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
      const schedulingIntent = isLikelyCalendarSchedulingRequest(message)
      const toolMessages = buildCoachBToolMessages(
        schedulingIntent ? `${prompt.instructions}${SCHEDULING_FORCE_SUFFIX}` : prompt.instructions,
        prompt.input
      )
      let { message: assistantMsg } = await runCoachBToolCompletion(
        toolMessages,
        schedulingIntent ? { forceToolName: "create_event" } : undefined
      )
      const toolCtx = {
        teamId: teamId!,
        sessionUser: params.sessionUser,
        inputSource,
      }
      let handled = await processCoachBToolMessage(assistantMsg, toolCtx)

      if (
        !schedulingIntent &&
        handled?.type === "action_proposal" &&
        (handled.actionType === "send_notification" || handled.actionType === "send_team_message") &&
        isLooseCalendarSchedulingHint(message)
      ) {
        console.warn("[Coach B] retrying with forced create_event after notify proposal", { teamId })
        const toolMessagesRetry = buildCoachBToolMessages(
          `${prompt.instructions}${SCHEDULING_FORCE_SUFFIX}`,
          prompt.input
        )
        const { message: assistantMsgRetry } = await runCoachBToolCompletion(toolMessagesRetry, {
          forceToolName: "create_event",
        })
        assistantMsg = assistantMsgRetry
        handled = await processCoachBToolMessage(assistantMsgRetry, toolCtx)
      }
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
        const r = assistantMsg.content.trim()
        return { type: "response", response: r, spokenText: deriveDefaultSpokenText(r) }
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
    return { type: "response", response: text, spokenText: deriveDefaultSpokenText(text) }
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
