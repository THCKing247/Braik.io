/**
 * App Router API route: app/api/events/route.ts
 * Canonical endpoint: POST /api/events (create event). GET returns 405.
 * Netlify: force-dynamic + nodejs runtime + fetchCache ensure this is built as a serverless function.
 */
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, getUserMembership } from "@/lib/auth/rbac"
import { requireBillingPermission } from "@/lib/billing/billing-state"
import { createNotifications } from "@/lib/utils/notifications"
import { logEventAction } from "@/lib/audit/structured-logger"
import { auditImpersonatedActionFromRequest } from "@/lib/admin/impersonation"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/enforcement/team-operation-guard"
import { revalidateTeamCalendar, revalidateTeamDashboardBootstrap } from "@/lib/cache/lightweight-get-cache"

/** Ensures this route is always run as a serverless function (e.g. on Netlify). */
export const dynamic = "force-dynamic"
/** Use Node runtime so POST is handled consistently on Netlify. */
export const runtime = "nodejs"
/** Prevent static/cache so Netlify always invokes the function for /api/events. */
export const fetchCache = "force-no-store"
export const revalidate = 0

/** OPTIONS: allow preflight to succeed so POST is not blocked. */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } })
}

/** GET not supported; use POST to create. Proves route is deployed (405 vs 404). */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } })
}

/** Create a calendar event. Path must be app/api/events/route.ts for POST /api/events. */
export async function POST(req: NextRequest) {
  let stage = "entry"
  try {
    console.log("[api/events] POST start")
    stage = "body_parse"

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid JSON"
      console.log("[api/events] error", { stage: "body_parse", message })
      return NextResponse.json(
        { error: "Event creation failed", stage: "body_parse", message },
        { status: 400 }
      )
    }
    const body = rawBody as Record<string, unknown>

    const hasTeamId = typeof body.teamId === "string"
    const hasTitle = typeof body.title === "string"
    const hasStart = body.start !== undefined && body.start !== null
    const hasStartAt = body.startAt !== undefined && body.startAt !== null
    const hasEnd = body.end !== undefined && body.end !== null
    const hasEndAt = body.endAt !== undefined && body.endAt !== null
    console.log("[api/events] body parsed", {
      bodyKeysPresent: Object.keys(body),
      required: {
        teamId: hasTeamId,
        title: hasTitle,
        start: hasStart || hasStartAt,
        end: hasEnd || hasEndAt,
      },
      optional: {
        type: typeof body.type === "string",
        audience: typeof body.audience === "string",
        notes: typeof body.notes === "string",
        location: typeof body.location === "string",
      },
    })

    const teamId = typeof body.teamId === "string" ? body.teamId.trim() : ""
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const startVal = body.start ?? body.startAt
    const endVal = body.end ?? body.endAt
    if (!teamId) {
      console.log("[api/events] returning 400", { reason: "TEAM_ID_REQUIRED", stage: "validation" })
      return NextResponse.json(
        {
          error: {
            code: "TEAM_ID_REQUIRED",
            message: "teamId is required",
            operation: "write",
          },
        },
        { status: 400 }
      )
    }
    if (!title) {
      console.log("[api/events] returning 400", { reason: "title_required", stage: "validation", teamId })
      return NextResponse.json(
        { error: "Event creation failed", stage: "validation", message: "title is required" },
        { status: 400 }
      )
    }
    if (!startVal || (typeof startVal !== "string" && typeof startVal !== "number")) {
      console.log("[api/events] returning 400", { reason: "start_required", stage: "validation", teamId })
      return NextResponse.json(
        { error: "Event creation failed", stage: "validation", message: "start or startAt is required" },
        { status: 400 }
      )
    }
    if (!endVal || (typeof endVal !== "string" && typeof endVal !== "number")) {
      console.log("[api/events] returning 400", { reason: "end_required", stage: "validation", teamId })
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

    console.log("[api/events] normalized payload", {
      teamId,
      title,
      start: startStr,
      end: endStr,
      type: eventType,
      visibility,
    })

    stage = "auth"
    const session = await getServerSession()
    if (!session?.user?.id) {
      console.log("[api/events] returning 401", { reason: "unauthorized", stage: "auth", teamId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    stage = "team_lookup"
    const supabaseForCheck = getSupabaseServer()
    const { data: teamRow } = await supabaseForCheck
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .maybeSingle()
    const teamFound = !!teamRow
    console.log("[api/events] debug", {
      userId,
      submittedTeamId: teamId,
      teamFound,
    })

    stage = "access_check"
    let accessPassed = false
    try {
      await requireTeamPermission(teamId, "post_announcements")
      await requireTeamOperationAccess(teamId, "write")
      await auditImpersonatedActionFromRequest(req, "event_create", { teamId })
      await requireBillingPermission(teamId, "editEvents")
      accessPassed = true
      console.log("[api/events] debug", { userId, submittedTeamId: teamId, teamFound, accessPassed: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      console.log("[api/events] debug", {
        userId,
        submittedTeamId: teamId,
        teamFound,
        accessPassed: false,
        errorCode: e instanceof TeamOperationBlockedError ? e.code : undefined,
        errorMessage: message,
      })
      if (e instanceof TeamOperationBlockedError) {
        return NextResponse.json(toStructuredTeamAccessError(e), { status: e.statusCode })
      }
      const isAccessDenied = message.includes("Forbidden") || message.includes("Not a member")
      if (isAccessDenied) {
        return NextResponse.json(
          {
            error: {
              code: "TEAM_ACCESS_DENIED",
              message: "You do not have write access to this team",
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
    const supabase = getSupabaseServer()
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
      const message = eventError?.message ?? "no event returned"
      console.log("[api/events] error", { stage: "insert", message })
      return NextResponse.json(
        { error: "Event creation failed", stage: "insert", message },
        { status: 500 }
      )
    }
    console.log("[api/events] insert ok")

    stage = "notifying"
    console.log("[api/events] notifying")
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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      console.log("[api/events] error", { stage: "notifying", message })
      // Event was inserted; do not fail the request
    }
    revalidateTeamCalendar(teamId)
    revalidateTeamDashboardBootstrap(teamId)
    console.log("[api/events] success")
    return NextResponse.json(event, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.log("[api/events] error", { stage, message })
    return NextResponse.json(
      {
        error: "Event creation failed",
        stage,
        message,
      },
      { status: 500 }
    )
  }
}
