/**
 * App Router API route: app/api/events/route.ts
 * Canonical endpoint: POST /api/events (create event). GET returns 405.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, getUserMembership } from "@/lib/auth/rbac"
import { requireBillingPermission } from "@/lib/billing/billing-state"
import { createNotifications } from "@/lib/utils/notifications"
import { logEventAction } from "@/lib/audit/structured-logger"
import { auditImpersonatedActionFromRequest } from "@/lib/admin/impersonation"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/enforcement/team-operation-guard"

/** Ensures this route is always run as a serverless function (e.g. on Netlify). */
export const dynamic = "force-dynamic"
/** Use Node runtime so POST is handled consistently on Netlify. */
export const runtime = "nodejs"

/** OPTIONS: allow preflight to succeed so POST is not blocked. */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } })
}

/** GET not supported; use POST to create. Proves route is deployed (405 vs 404). */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } })
}

/** Create a calendar event. Path must be app/api/events/route.ts for POST /api/events. */
export async function POST(req: Request) {
  let stage = "entry"
  try {
    console.log("[api/events] POST reached")
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

    const teamId = typeof body.teamId === "string" ? body.teamId.trim() : ""
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const startVal = body.start ?? body.startAt
    const endVal = body.end ?? body.endAt
    if (!teamId) {
      return NextResponse.json(
        { error: "Event creation failed", stage: "validation", message: "teamId is required" },
        { status: 400 }
      )
    }
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

    console.log("[api/events] body parsed", {
      teamId,
      title,
      start: startStr,
      end: endStr,
      type: eventType,
      visibility,
    })
    console.log("[api/events] normalized payload")

    stage = "auth"
    const session = await getServerSession()
    if (!session?.user?.id) {
      console.log("[api/events] error", { stage: "auth", message: "unauthorized" })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.log("[api/events] auth ok")

    stage = "access_check"
    try {
      await requireTeamPermission(teamId, "post_announcements")
      await requireTeamOperationAccess(teamId, "write")
      await auditImpersonatedActionFromRequest(req, "event_create", { teamId })
      await requireBillingPermission(teamId, "editEvents")
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      console.log("[api/events] error", { stage: "access_check", message })
      if (e instanceof TeamOperationBlockedError) {
        return NextResponse.json(toStructuredTeamAccessError(e), { status: e.statusCode })
      }
      const status = message.includes("Forbidden") || message.includes("Not a member") ? 403 : 500
      return NextResponse.json(
        { error: "Event creation failed", stage: "access_check", message },
        { status }
      )
    }
    console.log("[api/events] access ok")

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
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "event_created",
        target_type: "event",
        target_id: event.id,
        metadata: { teamId, title },
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
        linkUrl: `/dashboard/schedule`,
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
