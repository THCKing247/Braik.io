import type { SessionUser } from "@/lib/auth/server-auth"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireAuth, requireTeamPermission } from "@/lib/auth/rbac"
import { getProposal, markExecuted } from "@/lib/braik-ai/action-proposal-store"
import { createEventToolSchema, sendNotificationSchema, sendTeamMessageSchema } from "@/lib/braik-ai/coach-b-tools-schemas"
import { executeCreateEventInternal } from "@/lib/braik-ai/executors/create-event-internal"
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
  opts: { idempotencyKey?: string | null; incomingRequest?: Request | null }
): Promise<{ success: boolean; message?: string; executed?: Record<string, unknown> }> {
  const user = await requireAuth()
  const proposal = getProposal(proposalId)
  if (!proposal || proposal.status !== "pending") {
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

  console.log("[Coach B] confirm proposal triggered", {
    proposalId,
    actionType: proposal.actionType,
    teamId: proposal.teamId,
    idempotencyKey: opts.idempotencyKey ?? null,
    hasIncomingRequest: Boolean(opts.incomingRequest),
  })

  try {
    if (proposal.actionType === "create_event") {
      const parsed = createEventToolSchema.safeParse(proposal.payload)
      if (!parsed.success) {
        console.warn("[Coach B] create_event invalid payload", parsed.error.flatten())
        return { success: false, message: "Invalid stored event payload." }
      }

      console.log("[Coach B] create_event tool args", {
        proposalId,
        title: parsed.data.title,
        start_iso: parsed.data.start_iso,
        end_iso: parsed.data.end_iso,
        event_type: parsed.data.event_type,
        audience: parsed.data.audience,
      })

      if (opts.incomingRequest) {
        const api = await createTeamCalendarEventThroughApi(proposal.teamId, parsed.data, opts.incomingRequest)
        if (!api.ok) {
          return { success: false, message: api.message }
        }
        markExecuted(proposalId)
        return {
          success: true,
          message: `Created event "${parsed.data.title}".`,
          executed: { eventId: api.event.id, title: parsed.data.title },
        }
      }

      console.log("[Coach B] create_event fallback: executeCreateEventInternal (no Request context)")
      const res = await executeCreateEventInternal(parsed.data, {
        teamId: proposal.teamId,
        sessionUser,
      })
      if (res.type === "response") {
        return { success: false, message: res.response }
      }
      markExecuted(proposalId)
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
      const supabase = getSupabaseServer()
      const teamId = proposal.teamId
      const updates = payload.updates
      type Row = {
        team_id: string
        unit: string
        position: string
        string: number
        player_id: string | null
        formation: string | null
        special_team_type: string | null
      }
      const entriesToInsert: Row[] = []
      const seen = new Set<string>()
      for (const u of updates) {
        const stringNum = typeof u.string === "number" ? u.string : parseInt(String(u.string), 10)
        if (Number.isNaN(stringNum) || stringNum < 1) continue
        const unit = String(u.unit ?? "").trim()
        const position = String(u.position ?? "").trim()
        const key = `${unit}:${position}:${stringNum}`
        if (!unit || !position || seen.has(key)) continue
        seen.add(key)
        entriesToInsert.push({
          team_id: teamId,
          unit,
          position,
          string: stringNum,
          player_id: u.playerId && String(u.playerId).trim() ? String(u.playerId) : null,
          formation: u.formation != null && String(u.formation).trim() !== "" ? String(u.formation).trim() : null,
          special_team_type:
            u.specialTeamType != null && String(u.specialTeamType).trim() !== ""
              ? String(u.specialTeamType).trim()
              : null,
        })
      }
      if (entriesToInsert.length === 0) {
        return { success: false, message: "No valid depth chart rows." }
      }
      for (const row of entriesToInsert) {
        const { error: deleteError } = await supabase
          .from("depth_chart_entries")
          .delete()
          .eq("team_id", teamId)
          .eq("unit", row.unit)
          .eq("position", row.position)
        if (deleteError) {
          console.error("[Coach B depth chart] delete", deleteError)
        }
      }
      const { error: insertError } = await supabase.from("depth_chart_entries").insert(entriesToInsert)
      if (insertError) {
        console.error("[Coach B depth chart] insert", insertError)
        return { success: false, message: "Failed to update depth chart." }
      }
      markExecuted(proposalId)
      return { success: true, message: "Depth chart updated.", executed: { rows: entriesToInsert.length } }
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
      markExecuted(proposalId)
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
      markExecuted(proposalId)
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
