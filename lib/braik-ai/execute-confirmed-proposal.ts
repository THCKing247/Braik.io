import type { SessionUser } from "@/lib/auth/server-auth"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireAuth, requireTeamPermission } from "@/lib/auth/rbac"
import { getProposal, markExecuted } from "@/lib/braik-ai/action-proposal-store"
import { sendNotificationSchema, sendTeamMessageSchema } from "@/lib/braik-ai/coach-b-tools-schemas"
import {
  defaultSchedulingResolutionContext,
  schedulingPayloadToResolvedArgs,
  type SchedulingResolutionContext,
} from "@/lib/braik-ai/resolve-scheduling-slots"
import { executeCreateEventInternal } from "@/lib/braik-ai/executors/create-event-internal"
import { applyDepthChartUpdates } from "@/lib/braik-ai/executors/move-depth-chart-internal"
import { createTeamCalendarEventThroughApi } from "@/lib/calendar/coach-b-create-event-through-api"
function mapAnnouncementAudience(aud: string): "all" | "staff" | "players" | "parents" {
  if (aud === "team" || aud === "players") return "players"
  if (aud === "parents") return "parents"
  if (aud === "staff") return "staff"
  if (aud === "all") return "all"
  return "all"
}

export async function executeStoredProposal(
  proposalId: string,
  opts: {
    idempotencyKey?: string | null
    incomingRequest?: Request | null
    schedulingContext?: SchedulingResolutionContext | null
  }
): Promise<{ success: boolean; message?: string; executed?: Record<string, unknown> }> {
  const user = await requireAuth()
  const proposal = await getProposal(proposalId)
  if (!proposal || proposal.status !== "pending") {
    console.warn("[Coach B] executeStoredProposal: no pending proposal", { proposalId, userId: user.id })
    return { success: false, message: "Proposal not found or already handled." }
  }
  if (proposal.userId !== user.id) {
    return { success: false, message: "You can only confirm your own proposals." }
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email ?? "",
    name: user.name,
    role: user.role,
  }

  console.log("[Coach B] confirm proposal triggered — execution starting", {
    proposalId,
    actionType: proposal.actionType,
    teamId: proposal.teamId,
    idempotencyKey: opts.idempotencyKey ?? null,
    hasIncomingRequest: Boolean(opts.incomingRequest),
  })

  try {
    if (proposal.actionType === "create_event") {
      const schedCtx = opts.schedulingContext ?? defaultSchedulingResolutionContext()
      const parsed = schedulingPayloadToResolvedArgs(proposal.payload, schedCtx)
      if (!parsed.ok) {
        console.warn("[Coach B] create_event invalid or unresolvable payload", { proposalId })
        return { success: false, message: parsed.error }
      }

      console.log("[Coach B] create_event confirm — resolved args", {
        proposalId,
        title: parsed.resolved.title,
        start_iso: parsed.resolved.start_iso,
        end_iso: parsed.resolved.end_iso,
        event_type: parsed.resolved.event_type,
        audience: parsed.resolved.audience,
      })

      if (opts.incomingRequest) {
        const api = await createTeamCalendarEventThroughApi(proposal.teamId, parsed.resolved, opts.incomingRequest)
        if (!api.ok) {
          console.error("[Coach B] create_event calendar API failed", { proposalId, message: api.message })
          return { success: false, message: api.message }
        }
        await markExecuted(proposalId)
        console.log("[Coach B] create_event execution succeeded", { proposalId, eventId: api.event.id })
        return {
          success: true,
          message: `Created event "${parsed.resolved.title}".`,
          executed: { eventId: api.event.id, title: parsed.resolved.title },
        }
      }

      console.log("[Coach B] create_event fallback: executeCreateEventInternal (no Request context)")
      const res = await executeCreateEventInternal(parsed.resolved, {
        teamId: proposal.teamId,
        sessionUser,
        inputSource: "text",
        schedulingDisplay: { timeZone: schedCtx.timeZone, anchorLocalDate: schedCtx.localDate },
      })
      if (res.type === "response") {
        console.error("[Coach B] create_event internal failed", { proposalId, response: res.response })
        return { success: false, message: res.response }
      }
      await markExecuted(proposalId)
      return { success: true, message: res.message, executed: res.result }
    }

    if (proposal.actionType === "move_player_depth_chart") {
      const sess = await getServerSession()
      if (!sess?.user?.id) {
        return { success: false, message: "Unauthorized" }
      }
      await requireTeamPermission(proposal.teamId, "edit_roster", sess.user)

      const payload = proposal.payload as { teamId: string; updates: Array<Record<string, unknown>> }
      if (!payload?.updates?.length) {
        return { success: false, message: "Invalid depth chart payload." }
      }
      const teamId = proposal.teamId
      const mapped = payload.updates.map((u) => ({
        unit: String(u.unit ?? ""),
        position: String(u.position ?? ""),
        string: typeof u.string === "number" ? u.string : parseInt(String(u.string), 10),
        playerId: u.playerId && String(u.playerId).trim() ? String(u.playerId) : null,
        formation: u.formation != null ? String(u.formation) : null,
        specialTeamType: u.specialTeamType != null ? String(u.specialTeamType) : null,
      }))
      const applied = await applyDepthChartUpdates({ teamId, updates: mapped })
      if (!applied.ok) {
        return { success: false, message: applied.message }
      }
      await markExecuted(proposalId)
      console.log("[Coach B] move_player_depth_chart execution succeeded", { proposalId, rows: applied.rows })
      return { success: true, message: "Depth chart updated.", executed: { rows: applied.rows } }
    }

    if (proposal.actionType === "send_team_message") {
      const sess = await getServerSession()
      if (!sess?.user?.id) {
        return { success: false, message: "Unauthorized" }
      }
      await requireTeamPermission(proposal.teamId, "post_announcements", sess.user)

      const parsed = sendTeamMessageSchema.safeParse(proposal.payload)
      if (!parsed.success) {
        return { success: false, message: "Invalid message payload." }
      }
      const supabase = getSupabaseServer()
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle()
      const author_name =
        (prof as { full_name?: string; email?: string } | null)?.full_name?.trim() ||
        (prof as { email?: string } | null)?.email?.trim() ||
        null
      const audience = mapAnnouncementAudience(parsed.data.audience)
      const { data: inserted, error } = await supabase
        .from("team_announcements")
        .insert({
          team_id: proposal.teamId,
          title: parsed.data.title.slice(0, 500),
          body: parsed.data.body.slice(0, 20000),
          author_id: user.id,
          author_name,
          audience,
          is_pinned: false,
          send_notification: false,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error || !inserted) {
        console.error("[Coach B send_team_message]", error)
        return { success: false, message: "Failed to post message." }
      }
      await markExecuted(proposalId)
      console.log("[Coach B] send_team_message execution succeeded", { proposalId, announcementId: inserted.id })
      const { revalidateTeamAnnouncements, revalidateTeamEngagementHints } = await import(
        "@/lib/cache/lightweight-get-cache"
      )
      revalidateTeamAnnouncements(proposal.teamId)
      revalidateTeamEngagementHints(proposal.teamId)
      return { success: true, message: "Message posted.", executed: { announcementId: inserted.id } }
    }

    if (proposal.actionType === "send_notification") {
      const sess = await getServerSession()
      if (!sess?.user?.id) {
        return { success: false, message: "Unauthorized" }
      }
      await requireTeamPermission(proposal.teamId, "post_announcements", sess.user)

      const parsed = sendNotificationSchema.safeParse(proposal.payload)
      if (!parsed.success) {
        return { success: false, message: "Invalid notification payload." }
      }
      const supabase = getSupabaseServer()
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle()
      const author_name =
        (prof as { full_name?: string; email?: string } | null)?.full_name?.trim() ||
        (prof as { email?: string } | null)?.email?.trim() ||
        null
      const { data: inserted, error } = await supabase
        .from("team_announcements")
        .insert({
          team_id: proposal.teamId,
          title: parsed.data.title.slice(0, 500),
          body: parsed.data.body.slice(0, 20000),
          author_id: user.id,
          author_name,
          audience: parsed.data.audience,
          is_pinned: false,
          send_notification: Boolean(parsed.data.send_push),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error || !inserted) {
        console.error("[Coach B send_notification]", error)
        return { success: false, message: "Failed to post announcement." }
      }
      await markExecuted(proposalId)
      console.log("[Coach B] send_notification execution succeeded", { proposalId, announcementId: inserted.id })
      const { revalidateTeamAnnouncements, revalidateTeamEngagementHints } = await import(
        "@/lib/cache/lightweight-get-cache"
      )
      revalidateTeamAnnouncements(proposal.teamId)
      revalidateTeamEngagementHints(proposal.teamId)
      return { success: true, message: "Announcement posted.", executed: { announcementId: inserted.id } }
    }

    return { success: false, message: "Unknown action type." }
  } catch (e) {
    console.error("[executeStoredProposal]", e)
    return { success: false, message: e instanceof Error ? e.message : "Execution failed." }
  }
}
