import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, getUserMembership } from "@/lib/auth/rbac"
import { requireBillingPermission } from "@/lib/billing/billing-state"
import { createNotifications } from "@/lib/utils/notifications"
import { logEventAction } from "@/lib/audit/structured-logger"
import { auditImpersonatedActionFromRequest } from "@/lib/admin/impersonation"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/enforcement/team-operation-guard"

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, type, title, start, end, location, notes, audience } = await request.json()

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
        description: notes || null,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        location: location || null,
        visibility,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (eventError || !event) {
      throw new Error(eventError?.message ?? "Failed to create event")
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
      body: `${eventType} - ${new Date(start).toLocaleDateString()} at ${new Date(start).toLocaleTimeString()}`,
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

    return NextResponse.json(event)
  } catch (error: unknown) {
    if (error instanceof TeamOperationBlockedError) {
      return NextResponse.json(toStructuredTeamAccessError(error), { status: error.statusCode })
    }
    console.error("Event error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
