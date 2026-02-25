import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission, getUserMembership } from "@/lib/rbac"
import { requireBillingPermission } from "@/lib/billing-state"
import { createNotifications } from "@/lib/notifications"
import { logEventAction } from "@/lib/structured-logger"
import { requireTeamServiceWriteAccess } from "@/lib/team-service-status"
import { auditImpersonatedActionFromRequest } from "@/lib/impersonation"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, type, title, start, end, location, notes, audience } = await request.json()

    await requireTeamPermission(teamId, "post_announcements") // Reuse permission for events
    await requireTeamServiceWriteAccess(teamId, prisma)
    await auditImpersonatedActionFromRequest(request, "event_create", { teamId })
    
    // Check billing state - read-only mode blocks event creation
    await requireBillingPermission(teamId, "editEvents", prisma)

    // Map old type values to new eventType enum
    const eventTypeMap: Record<string, string> = {
      practice: "PRACTICE",
      game: "GAME",
      meeting: "MEETING",
      other: "CUSTOM",
    }
    const eventType = eventTypeMap[type] || "CUSTOM"

    // Map old audience values to new visibility enum
    const visibilityMap: Record<string, string> = {
      all: "PARENTS_AND_TEAM",
      players: "TEAM",
      parents: "PARENTS_AND_TEAM",
      staff: "COACHES_ONLY",
    }
    const visibility = visibilityMap[audience] || "TEAM"

    const event = await prisma.event.create({
      data: {
        teamId,
        eventType,
        title,
        description: notes || null,
        start: new Date(start),
        end: new Date(end),
        location: location || null,
        visibility,
        createdBy: session.user.id,
      },
      include: {
        creator: { select: { name: true, email: true } },
        rsvps: {
          include: {
            player: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "event_created",
        metadata: { eventId: event.id, title },
      },
    })

    // Log event creation
    const membership = await getUserMembership(teamId)
    logEventAction("event_created", {
      userId: session.user.id,
      teamId,
      role: membership?.role,
      eventId: event.id,
      eventType,
      title,
    })

    // Create notifications for event creation (exclude creator)
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
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        location: event.location,
      },
      excludeUserIds: [session.user.id], // Don't notify the creator
    })

    return NextResponse.json(event)
  } catch (error: any) {
    console.error("Event error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

