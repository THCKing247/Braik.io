import { NextResponse } from "next/server"
import {
  getServerSession,
  getRequestUserLite,
  applyRefreshedSessionCookies,
  type SessionUser,
} from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser, requireTeamPermission, getUserMembership } from "@/lib/auth/rbac"
import { requireBillingPermission } from "@/lib/billing/billing-state"
import { createNotifications } from "@/lib/utils/notifications"
import { logEventAction } from "@/lib/audit/structured-logger"
import { auditImpersonatedActionFromRequest } from "@/lib/admin/impersonation"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/enforcement/team-operation-guard"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import {
  getCachedTeamCalendarEventsInRange,
  getCachedTeamCalendarEventsDefaultWindow,
} from "@/lib/teams/cached-team-calendar-events"
import { revalidateTeamCalendar, revalidateTeamDashboardBootstrap } from "@/lib/cache/lightweight-get-cache"

const CALENDAR_EVENTS_CACHE_CONTROL =
  "private, max-age=0, s-maxage=60, stale-while-revalidate=300"

/**
 * GET /api/teams/[teamId]/calendar/events?from=<ISO>&to=<ISO>
 * Returns events overlapping [from, to] (overlap semantics). Omits joins except batched creator lookup.
 * Legacy: omit from/to to use a wide default window (month-aligned, ~6mo back → 24mo forward).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const sessionResult = await getRequestUserLite()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const u = sessionResult.user
    const sessionUser: SessionUser = {
      id: u.id,
      email: u.email,
      role: u.role,
      teamId: u.teamId,
      isPlatformOwner: u.isPlatformOwner,
    }

    await requireTeamAccessWithUser(teamId, sessionUser)

    const sp = new URL(request.url).searchParams
    const from = sp.get("from")?.trim()
    const to = sp.get("to")?.trim()

    try {
      const events =
        from && to
          ? await getCachedTeamCalendarEventsInRange(teamId, from, to)
          : await getCachedTeamCalendarEventsDefaultWindow(teamId)
      const res = NextResponse.json(events)
      res.headers.set("Cache-Control", CALENDAR_EVENTS_CACHE_CONTROL)
      if (sessionResult.refreshedSession) {
        applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
      }
      return res
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load events"
      console.error("[GET /api/teams/.../calendar/events]", msg, e)
      return NextResponse.json({ error: "Failed to load events" }, { status: 500 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../calendar/events]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/calendar/events - create event (same behavior as POST /api/events).
 * Use this path when /api/events is unavailable (e.g. 404 on Netlify).
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  let stage = "entry"
  try {
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    stage = "body_parse"
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid JSON"
      return NextResponse.json(
        { error: "Event creation failed", stage: "body_parse", message },
        { status: 400 }
      )
    }
    const body = rawBody as Record<string, unknown>

    const title = typeof body.title === "string" ? body.title.trim() : ""
    const startVal = body.start ?? body.startAt
    const endVal = body.end ?? body.endAt
    if (!title) {
      return NextResponse.json(
        { error: "Event creation failed", stage: "validation", message: "title is required" },
        { status: 400 }
      )
    }
    if (!startVal || (typeof startVal !== "string" && typeof startVal !== "number")) {
      return NextResponse.json(
        { error: "Event creation failed", stage: "validation", message: "start or startAt is required" },
        { status: 400 }
      )
    }
    if (!endVal || (typeof endVal !== "string" && typeof endVal !== "number")) {
      return NextResponse.json(
        { error: "Event creation failed", stage: "validation", message: "end or endAt is required" },
        { status: 400 }
      )
    }

    const startStr = typeof startVal === "string" ? startVal : new Date(startVal).toISOString()
    const endStr = typeof endVal === "string" ? endVal : new Date(endVal).toISOString()

    const typeStr = typeof body.type === "string" ? body.type : ""
    const eventTypeMap: Record<string, string> = {
      practice: "PRACTICE",
      game: "GAME",
      meeting: "MEETING",
      follow_up: "FOLLOW_UP",
      other: "CUSTOM",
    }
    const eventType = eventTypeMap[typeStr] || "CUSTOM"
    const audienceStr = typeof body.audience === "string" ? body.audience : ""
    const visibilityMap: Record<string, string> = {
      all: "PARENTS_AND_TEAM",
      players: "TEAM",
      parents: "PARENTS_AND_TEAM",
      staff: "COACHES_ONLY",
    }
    const visibility = visibilityMap[audienceStr] || "TEAM"

    stage = "auth"
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    // Debug: route params and raw team lookup (service role client; no RLS)
    const supabaseDebug = getSupabaseServer()
    const { data: teamRowDebug, error: teamLookupError } = await supabaseDebug
      .from("teams")
      .select("id, program_id, team_status, created_by")
      .eq("id", teamId)
      .maybeSingle()

    console.log("[POST /api/teams/.../calendar/events] debug", {
      routeTeamId: teamId,
      routeTeamIdLength: teamId?.length,
      userId,
      teamLookupFound: !!teamRowDebug,
      teamLookupError: teamLookupError?.message ?? null,
      teamProgramId: teamRowDebug?.program_id ?? null,
    })

    let membershipResult: Awaited<ReturnType<typeof getUserMembership>> = null
    try {
      membershipResult = await getUserMembership(teamId)
    } catch (membershipErr) {
      console.log("[POST /api/teams/.../calendar/events] membership lookup error", {
        teamId,
        userId,
        error: membershipErr instanceof Error ? membershipErr.message : String(membershipErr),
      })
      throw membershipErr
    }
    console.log("[POST /api/teams/.../calendar/events] membership", {
      teamId,
      userId,
      hasMembership: !!membershipResult,
      role: membershipResult?.role ?? null,
    })

    stage = "access_check"
    try {
      await requireTeamPermission(teamId, "post_announcements")
      await requireTeamOperationAccess(teamId, "write")
      await auditImpersonatedActionFromRequest(request, "event_create", { teamId })
      await requireBillingPermission(teamId, "editEvents")
      console.log("[POST /api/teams/.../calendar/events] access_check passed", { teamId, userId })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      console.log("[POST /api/teams/.../calendar/events] access_check failed", {
        teamId,
        userId,
        errorMessage: message,
        isTeamOperationBlocked: e instanceof TeamOperationBlockedError,
        code: e instanceof TeamOperationBlockedError ? e.code : null,
      })

      if (e instanceof TeamOperationBlockedError) {
        if (e.code === "TEAM_NOT_FOUND" && teamRowDebug) {
          // Team exists in our direct lookup but guard said not found (e.g. client/filter mismatch)
          console.warn("[POST /api/teams/.../calendar/events] TEAM_NOT_FOUND but team row exists in route lookup", {
            teamId,
            userId,
          })
          return NextResponse.json(
            {
              error: {
                code: "PERMISSION_DENIED",
                message: "Write access to this team could not be verified.",
                teamId,
                operation: "write",
              },
            },
            { status: 403 }
          )
        }
        return NextResponse.json(toStructuredTeamAccessError(e), { status: e.statusCode })
      }

      const isPermissionDenied = message.includes("Forbidden") || message.includes("Not a member") || message.includes("Access denied")
      if (isPermissionDenied) {
        return NextResponse.json(
          {
            error: {
              code: "PERMISSION_DENIED",
              message: "You do not have permission to create events for this team.",
              teamId,
              operation: "write",
            },
          },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: "Event creation failed", stage: "access_check", message },
        { status: 500 }
      )
    }

    const notesVal = typeof body.notes === "string" ? body.notes : null
    const locationVal = typeof body.location === "string" ? body.location : null

    stage = "insert"
    let supabase
    try {
      supabase = getSupabaseServer()
    } catch (supabaseErr) {
      const msg = supabaseErr instanceof Error ? supabaseErr.message : "Supabase not configured"
      console.error("[POST /api/teams/.../calendar/events] getSupabaseServer failed", supabaseErr)
      return NextResponse.json(
        { error: "Event creation failed", stage: "config", message: msg },
        { status: 500 }
      )
    }

    // Ensure public.users has a row for this auth user (events.created_by references public.users.id).
    // If the user signed in via a path that didn't run the login upsert, they may be missing.
    const userTableRole = profileRoleToUserRole((session.user.role ?? "user").toLowerCase())
    try {
      await supabase
        .from("users")
        .upsert(
          {
            id: userId,
            email: session.user.email,
            name: session.user.name ?? null,
            role: userTableRole,
            status: "active",
          },
          { onConflict: "id" }
        )
    } catch (userUpsertErr) {
      console.warn("[POST /api/teams/.../calendar/events] users upsert best-effort failed", {
        userId,
        message: userUpsertErr instanceof Error ? userUpsertErr.message : String(userUpsertErr),
      })
      // Continue — insert may still succeed if user already exists
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        team_id: teamId,
        event_type: eventType,
        title,
        description: notesVal,
        start: new Date(startStr).toISOString(),
        end: new Date(endStr).toISOString(),
        location: locationVal,
        visibility,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (eventError || !event) {
      const code = eventError?.code ?? ""
      const message = eventError?.message ?? "no event returned"
      console.error("[POST /api/teams/.../calendar/events] insert failed", {
        teamId,
        userId: session.user.id,
        code,
        message,
        details: eventError?.details,
      })
      const friendlyMessage =
        code === "23503"
          ? "User or team record missing. Please sign out and sign in again, then try creating the event."
          : message
      return NextResponse.json(
        { error: "Event creation failed", stage: "insert", message: friendlyMessage },
        { status: 500 }
      )
    }

    stage = "notifying"
    try {
      const { writeAuditLog } = await import("@/lib/audit/write-audit-log")
      await writeAuditLog({
        actorUserId: session.user.id,
        teamId,
        actionType: "event_created",
        targetType: "event",
        targetId: event.id,
        metadata: { title },
      })
      const membership = await getUserMembership(teamId)
      logEventAction("event_created", {
        userId: session.user.id,
        teamId,
        role: membership?.role,
        eventId: event.id,
        eventType,
        title,
      })
      await createNotifications({
        type: "event_created",
        teamId,
        title: `New event: ${title}`,
        body: `${eventType} - ${new Date(startStr).toLocaleDateString()} at ${new Date(startStr).toLocaleTimeString()}`,
        linkUrl: `/dashboard/calendar`,
        linkType: "event",
        linkId: event.id,
        metadata: {
          eventId: event.id,
          eventType,
          start: event.start,
          end: event.end,
          location: event.location,
        },
        excludeUserIds: [session.user.id],
      })
    } catch {
      // Event was inserted; do not fail the request
    }

    revalidateTeamCalendar(teamId)
    revalidateTeamDashboardBootstrap(teamId)

    return NextResponse.json(event, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[POST /api/teams/.../calendar/events] unhandled error", {
      stage,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: "Event creation failed", stage, message },
      { status: 500 }
    )
  }
}
