import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, getUserMembership } from "@/lib/auth/rbac"
import { requireBillingPermission } from "@/lib/billing/billing-state"
import { createNotifications } from "@/lib/utils/notifications"
import { logEventAction } from "@/lib/audit/structured-logger"
import { auditImpersonatedActionFromRequest } from "@/lib/admin/impersonation"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/enforcement/team-operation-guard"

/** GET not supported; use POST to create. Enables checking that the route exists (405 vs 404). */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } })
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "test") {
    console.log("[POST /api/events] request received")
  }
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[POST /api/events] validation failed: unauthorized")
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      if (process.env.NODE_ENV !== "test") {
        console.log("[POST /api/events] validation failed: invalid JSON")
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { teamId, type, title, start, end, location, notes, audience } = body as Record<string, unknown>

    if (!teamId || typeof teamId !== "string" || !teamId.trim()) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[POST /api/events] validation failed: missing or invalid teamId")
      }
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[POST /api/events] validation failed: missing or invalid title")
      }
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }
    const startVal = start ?? (body as Record<string, unknown>).startAt
    const endVal = end ?? (body as Record<string, unknown>).endAt
    if (!startVal || (typeof startVal !== "string" && typeof startVal !== "number")) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[POST /api/events] validation failed: missing or invalid start/startAt")
      }
      return NextResponse.json({ error: "start or startAt is required (ISO string)" }, { status: 400 })
    }
    if (!endVal || (typeof endVal !== "string" && typeof endVal !== "number")) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[POST /api/events] validation failed: missing or invalid end/endAt")
      }
      return NextResponse.json({ error: "end or endAt is required (ISO string)" }, { status: 400 })
    }

    const startStr = typeof startVal === "string" ? startVal : new Date(startVal).toISOString()
    const endStr = typeof endVal === "string" ? endVal : new Date(endVal).toISOString()

    await requireTeamPermission(teamId, "post_announcements")
    await requireTeamOperationAccess(teamId, "write")
    await auditImpersonatedActionFromRequest(request, "event_create", { teamId })

    await requireBillingPermission(teamId, "editEvents")

    const eventTypeMap: Record<string, string> = {
      practice: "PRACTICE",
      game: "GAME",
      meeting: "MEETING",
      other: "CUSTOM",
    }
    const eventType = eventTypeMap[type] || "CUSTOM"

    const visibilityMap: Record<string, string> = {
      all: "PARENTS_AND_TEAM",
      players: "TEAM",
      parents: "PARENTS_AND_TEAM",
      staff: "COACHES_ONLY",
    }
    const visibility = visibilityMap[audience] || "TEAM"

    const supabase = getSupabaseServer()
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        team_id: teamId,
        event_type: eventType,
        title,
        description: (notes as string) || null,
        start: new Date(startStr).toISOString(),
        end: new Date(endStr).toISOString(),
        location: (location as string) || null,
        visibility,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (eventError || !event) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[POST /api/events] Supabase insert error:", eventError?.message ?? "no event returned")
      }
      return NextResponse.json(
        { error: eventError?.message ?? "Failed to create event" },
        { status: 500 }
      )
    }

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

    if (process.env.NODE_ENV !== "test") {
      console.log("[POST /api/events] event created id:", event.id)
    }
    return NextResponse.json(event)
  } catch (error: unknown) {
    if (error instanceof TeamOperationBlockedError) {
      if (process.env.NODE_ENV !== "test") {
        console.log("[POST /api/events] team operation blocked:", error.statusCode)
      }
      return NextResponse.json(toStructuredTeamAccessError(error), { status: error.statusCode })
    }
    if (process.env.NODE_ENV !== "test") {
      console.error("[POST /api/events] error:", error instanceof Error ? error.message : error)
    }
    const message = error instanceof Error ? error.message : "Internal server error"
    const status = message.includes("Forbidden") || message.includes("Not a member") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
