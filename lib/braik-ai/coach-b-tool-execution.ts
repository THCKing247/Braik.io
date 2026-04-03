import type { ChatCompletionMessage } from "openai/resources/chat/completions"
import type { SessionUser } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { executeCreateEventInternal } from "@/lib/braik-ai/executors/create-event-internal"
import { createProposal, type ProposalActionType } from "@/lib/braik-ai/action-proposal-store"
import { requireTeamPermission } from "@/lib/auth/rbac"
import { checkCoachBActionRateLimit } from "@/lib/braik-ai/coach-b-rate-limit"
import {
  createEventToolSchema,
  draftTeamMessageSchema,
  movePlayerDepthChartSchema,
  sendNotificationSchema,
  sendTeamMessageSchema,
} from "@/lib/braik-ai/coach-b-tools-schemas"

export type ToolHandlerResult =
  | {
      type: "response"
      response: string
      actionPreview?: { summary: string; items: unknown[]; affectedCount: number }
    }
  | {
      type: "action_proposal"
      message: string
      proposalId: string
      actionType: ProposalActionType
      preview: { summary: string; items: unknown[]; affectedCount: number }
    }
  | { type: "action_executed"; message: string; result?: Record<string, unknown> }

export interface ToolExecutionContext {
  teamId: string
  sessionUser: SessionUser
  inputSource: "text" | "voice"
}

async function resolvePlayerIdForTeam(teamId: string, jerseyNumber: number): Promise<string | null> {
  const supabase = getSupabaseServer()
  const { data } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .eq("jersey_number", jerseyNumber)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

async function executeCreateEvent(args: unknown, ctx: ToolExecutionContext): Promise<ToolHandlerResult> {
  const parsed = createEventToolSchema.safeParse(args)
  if (!parsed.success) {
    return { type: "response", response: `Could not create event: invalid fields (${parsed.error.message}).` }
  }
  const res = await executeCreateEventInternal(parsed.data, { teamId: ctx.teamId, sessionUser: ctx.sessionUser })
  if (res.type === "response") return res
  return { type: "action_executed", message: res.message, result: res.result }
}

export async function processCoachBToolMessage(
  message: ChatCompletionMessage,
  ctx: ToolExecutionContext
): Promise<ToolHandlerResult | null> {
  const calls = message.tool_calls
  if (!calls?.length) return null

  const first = calls[0]
  if (first.type !== "function") return null

  const name = first.function.name
  let rawArgs: unknown = {}
  try {
    rawArgs = first.function.arguments ? JSON.parse(first.function.arguments) : {}
  } catch {
    return { type: "response", response: "I could not parse that action. Please rephrase." }
  }

  console.log("[Coach B] tool call", { name, teamId: ctx.teamId, userId: ctx.sessionUser.id, inputSource: ctx.inputSource })

  if (name === "draft_team_message") {
    const parsed = draftTeamMessageSchema.safeParse(rawArgs)
    if (!parsed.success) {
      return { type: "response", response: "Draft failed: check message content." }
    }
    const hint = parsed.data.audience_hint ? ` (audience: ${parsed.data.audience_hint})` : ""
    return {
      type: "response",
      response: `Draft message${hint}:\n\n${parsed.data.body}`,
    }
  }

  if (name === "create_event") {
    const mustConfirm = ctx.inputSource === "voice"
    if (mustConfirm) {
      const parsedEvent = createEventToolSchema.safeParse(rawArgs)
      if (!parsedEvent.success) {
        return { type: "response", response: "I need clearer date/time and title to schedule that." }
      }
      const stored = createProposal({
        teamId: ctx.teamId,
        userId: ctx.sessionUser.id,
        actionType: "create_event",
        payload: parsedEvent.data,
        preview: {
          summary: `Create event: ${parsedEvent.data.title}`,
          items: [parsedEvent.data],
          affectedCount: 1,
        },
        inputSource: ctx.inputSource,
        idempotencyKey: null,
      })
      return {
        type: "action_proposal",
        proposalId: stored.id,
        actionType: "create_event",
        message: `You're about to create calendar event "${parsedEvent.data.title}". Do you want me to create it? Reply with yes, send it, or confirm — or use Confirm below.`,
        preview: stored.preview,
      }
    }
    return executeCreateEvent(rawArgs, ctx)
  }

  if (name === "move_player_depth_chart") {
    try {
      await requireTeamPermission(ctx.teamId, "edit_roster", ctx.sessionUser)
    } catch {
      return { type: "response", response: "You don't have permission to edit the depth chart." }
    }
    const parsed = movePlayerDepthChartSchema.safeParse(rawArgs)
    if (!parsed.success) {
      return { type: "response", response: "I need jersey number or player and position details to move depth chart." }
    }
    let playerId = parsed.data.player_id ?? null
    if (!playerId && parsed.data.jersey_number != null) {
      playerId = await resolvePlayerIdForTeam(ctx.teamId, parsed.data.jersey_number)
    }
    if (!playerId) {
      return { type: "response", response: "Could not find that jersey number on your roster for this team." }
    }
    const updates = [
      {
        unit: parsed.data.unit,
        position: parsed.data.position,
        string: parsed.data.string,
        playerId,
        formation: null as string | null,
        specialTeamType: null as string | null,
      },
    ]
    const p = createProposal({
      teamId: ctx.teamId,
      userId: ctx.sessionUser.id,
      actionType: "move_player_depth_chart",
      payload: { teamId: ctx.teamId, updates },
      preview: {
        summary: `Move player to ${parsed.data.unit} ${parsed.data.position} string ${parsed.data.string}`,
        items: updates,
        affectedCount: 1,
      },
      inputSource: ctx.inputSource,
      idempotencyKey: null,
    })
    return {
      type: "action_proposal",
      proposalId: p.id,
      actionType: "move_player_depth_chart",
      message:
        "You're about to update the depth chart for that player. Do you want me to apply this change? Reply yes, send it, or confirm — or use Confirm below.",
      preview: p.preview,
    }
  }

  if (name === "send_team_message" || name === "send_notification") {
    const rate = checkCoachBActionRateLimit(`${ctx.sessionUser.id}:${ctx.teamId}:notify`)
    if (!rate.ok) {
      return {
        type: "response",
        response: "Too many send attempts in a short window. Please wait a moment and try again.",
      }
    }
    if (name === "send_team_message") {
      try {
        await requireTeamPermission(ctx.teamId, "post_announcements", ctx.sessionUser)
      } catch {
        return { type: "response", response: "You don't have permission to post team messages." }
      }
      const parsed = sendTeamMessageSchema.safeParse(rawArgs)
      if (!parsed.success) {
        return { type: "response", response: "I need a title, body, and audience to draft that message." }
      }
      const p = createProposal({
        teamId: ctx.teamId,
        userId: ctx.sessionUser.id,
        actionType: "send_team_message",
        payload: parsed.data,
        preview: {
          summary: parsed.data.title,
          items: [{ body: parsed.data.body, audience: parsed.data.audience }],
          affectedCount: 1,
        },
        inputSource: ctx.inputSource,
        idempotencyKey: null,
      })
      const audienceLabel =
        parsed.data.audience === "parents" ? "parents" : parsed.data.audience === "staff" ? "staff" : "the team"
      return {
        type: "action_proposal",
        proposalId: p.id,
        actionType: "send_team_message",
        message: `You're about to send a message to ${audienceLabel}. Do you want me to post it? Reply yes, send it, or confirm — or use Confirm below.`,
        preview: p.preview,
      }
    }
    try {
      await requireTeamPermission(ctx.teamId, "post_announcements", ctx.sessionUser)
    } catch {
      return { type: "response", response: "You don't have permission to post announcements." }
    }
    const parsed = sendNotificationSchema.safeParse(rawArgs)
    if (!parsed.success) {
      return { type: "response", response: "I need title, body, and audience for that notification." }
    }
    const p = createProposal({
      teamId: ctx.teamId,
      userId: ctx.sessionUser.id,
      actionType: "send_notification",
      payload: parsed.data,
      preview: {
        summary: parsed.data.title,
        items: [{ body: parsed.data.body, audience: parsed.data.audience, send_push: parsed.data.send_push }],
        affectedCount: 1,
      },
      inputSource: ctx.inputSource,
      idempotencyKey: null,
    })
    return {
      type: "action_proposal",
      proposalId: p.id,
      actionType: "send_notification",
      message:
        "You're about to post an announcement and may trigger notifications. Do you want me to send it? Reply yes, send it, or confirm — or use Confirm below.",
      preview: p.preview,
    }
  }

  return { type: "response", response: "That action is not available." }
}
