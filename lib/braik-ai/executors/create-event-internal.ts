import type { SessionUser } from "@/lib/auth/server-auth"
import { getUserMembership, requireTeamPermission } from "@/lib/auth/rbac"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { requireBillingPermission } from "@/lib/billing/billing-state"
import { requireTeamOperationAccess } from "@/lib/enforcement/team-operation-guard"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { createNotifications } from "@/lib/utils/notifications"
import { logEventAction } from "@/lib/audit/structured-logger"
import { revalidateTeamCalendar, revalidateTeamDashboardBootstrap } from "@/lib/cache/lightweight-get-cache"
import type { CreateEventToolArgs } from "@/lib/braik-ai/coach-b-tools-schemas"

function visibilityFromAudience(aud: string | undefined): string {
  const visibilityMap: Record<string, string> = {
    all: "PARENTS_AND_TEAM",
    parents: "PARENTS_AND_TEAM",
    team: "TEAM",
    staff: "COACHES_ONLY",
  }
  return visibilityMap[aud ?? "team"] ?? "TEAM"
}

export async function executeCreateEventInternal(
  a: CreateEventToolArgs,
  ctx: { teamId: string; sessionUser: SessionUser }
): Promise<
  | {
      type: "action_executed"
      message: string
      spokenText: string
      result: { eventId: string; title: string }
    }
  | { type: "response"; response: string }
> {
  let start: Date
  let end: Date
  try {
    start = new Date(a.start_iso)
    end = new Date(a.end_iso)
  } catch {
    return { type: "response", response: "Could not create event: invalid dates." }
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { type: "response", response: "Could not create event: could not parse start/end times." }
  }

  const eventTypeMap: Record<string, string> = {
    practice: "PRACTICE",
    game: "GAME",
    meeting: "MEETING",
    other: "CUSTOM",
  }
  const eventType = eventTypeMap[a.event_type] ?? "CUSTOM"

  console.log("[Coach B create_event] execution start", {
    teamId: ctx.teamId,
    userId: ctx.sessionUser.id,
    title: a.title,
    start_iso: a.start_iso,
    end_iso: a.end_iso,
    event_type: a.event_type,
    resolved_event_type: eventType,
    location: a.location ?? null,
    audience: a.audience ?? "team",
  })

  try {
    await requireTeamPermission(ctx.teamId, "post_announcements", ctx.sessionUser)
    await requireTeamOperationAccess(ctx.teamId, "write")
    await requireBillingPermission(ctx.teamId, "editEvents")
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Permission denied"
    return { type: "response", response: `Cannot create event: ${msg}` }
  }

  const supabase = getSupabaseServer()
  const userId = ctx.sessionUser.id
  const userTableRole = profileRoleToUserRole((ctx.sessionUser.role ?? "user").toLowerCase())
  try {
    await supabase.from("users").upsert(
      {
        id: userId,
        email: ctx.sessionUser.email,
        name: ctx.sessionUser.name ?? null,
        role: userTableRole,
        status: "active",
      },
      { onConflict: "id" }
    )
  } catch {
    /* best-effort */
  }

  const visibility = visibilityFromAudience(a.audience ?? "team")
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      team_id: ctx.teamId,
      event_type: eventType,
      title: a.title,
      description: null,
      start: start.toISOString(),
      end: end.toISOString(),
      location: a.location?.trim() || null,
      visibility,
      created_by: userId,
    })
    .select()
    .single()

  if (error || !event) {
    console.error("[Coach B create_event] DB insert failed — not claiming success", {
      teamId: ctx.teamId,
      title: a.title,
      pg: error?.message ?? error,
      code: error?.code,
    })
    return {
      type: "response",
      response:
        "The calendar save failed on the server—nothing was added. Check permissions or try again from the calendar page.",
    }
  }

  const row = event as { id: string; start?: string; end?: string }
  console.log("[Coach B create_event] DB OK — events row persisted", {
    teamId: ctx.teamId,
    eventId: row.id,
    title: a.title,
    dbStart: row.start ?? start.toISOString(),
    dbEnd: row.end ?? end.toISOString(),
    event_type: eventType,
    visibility,
  })

  try {
    const { writeAuditLog } = await import("@/lib/audit/write-audit-log")
    await writeAuditLog({
      actorUserId: userId,
      teamId: ctx.teamId,
      actionType: "event_created",
      targetType: "event",
      targetId: event.id,
      metadata: { title: a.title, source: "coach_b_ai" },
    })
    const membership = await getUserMembership(ctx.teamId)
    logEventAction("event_created", {
      userId,
      teamId: ctx.teamId,
      role: membership?.role,
      eventId: event.id,
      eventType,
      title: a.title,
    })
    await createNotifications({
      type: "event_created",
      teamId: ctx.teamId,
      title: `New event: ${a.title}`,
      body: `${eventType} — ${start.toLocaleString()}`,
      linkUrl: `/dashboard/calendar`,
      linkType: "event",
      linkId: event.id,
      metadata: { eventId: event.id, source: "coach_b_ai" },
      excludeUserIds: [userId],
    })
  } catch {
    /* non-fatal */
  }

  revalidateTeamCalendar(ctx.teamId)
  revalidateTeamDashboardBootstrap(ctx.teamId)

  const timeShort = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  const dateShort = start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
  const loc = a.location?.trim()
  const place = loc ? ` at ${loc}` : ""

  const message = `Added "${a.title}" to the calendar for ${dateShort} at ${timeShort}${place}.\n\nWant me to notify players or parents too?`

  /** One short sentence for TTS; full details stay in `message` for the chat UI. */
  const spokenText = `It's on the calendar — ${a.title}, ${dateShort} at ${timeShort}${place}.`

  console.log("[Coach B create_event] success + follow-up offered", {
    teamId: ctx.teamId,
    eventId: event.id,
    title: a.title,
    requestedAction: "create_event",
    executedAction: "events.insert",
    followUp: "notify_players_or_parents",
  })

  return {
    type: "action_executed",
    message,
    spokenText,
    result: { eventId: event.id, title: a.title },
  }
}
