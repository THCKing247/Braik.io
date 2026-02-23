import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { canEditEvent, canRemoveEvent } from "@/lib/calendar-hierarchy"
import { requireBillingPermission } from "@/lib/billing-state"
import { createNotifications } from "@/lib/notifications"
import { logEventAction, logPermissionDenial } from "@/lib/structured-logger"

// PATCH /api/teams/[teamId]/calendar/events/[eventId]
export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string; eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, eventId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check billing state - read-only mode blocks event edits
    await requireBillingPermission(teamId, "editEvents", prisma)

    // Get existing event
    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!existingEvent || existingEvent.teamId !== teamId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get full membership details for permission checking
    const fullMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    })

    if (!fullMembership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 })
    }

    // Hierarchical permission check per BRAIK_MASTER_INTENT.md
    const canEdit = await canEditEvent(
      session.user.id,
      {
        id: existingEvent.id,
        teamId: existingEvent.teamId,
        createdBy: existingEvent.createdBy,
        scopedPlayerIds: existingEvent.scopedPlayerIds as string[] | null,
        scopedPositionGroups: existingEvent.scopedPositionGroups as string[] | null,
        scopedUnit: existingEvent.scopedUnit as "OFFENSE" | "DEFENSE" | "SPECIAL_TEAMS" | null,
        coordinatorType: existingEvent.coordinatorType as "OC" | "DC" | "ST" | null,
      },
      {
        role: membership.role,
        permissions: fullMembership.permissions,
        positionGroups: fullMembership.positionGroups as string[] | null,
      }
    )

    if (!canEdit) {
      logPermissionDenial({
        userId: session.user.id,
        teamId,
        role: membership.role,
        reason: "Insufficient permissions to edit this event (hierarchical check failed)",
      })
      return NextResponse.json(
        { error: "You don't have permission to edit this event" },
        { status: 403 }
      )
    }

    // Legacy: Check if event is locked (for backward compatibility)
    if (existingEvent.locked && membership.role === "ASSISTANT_COACH" && existingEvent.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: "This event is locked and cannot be edited" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.start !== undefined) updateData.start = new Date(body.start)
    if (body.end !== undefined) updateData.end = new Date(body.end)
    if (body.location !== undefined) updateData.location = body.location
    if (body.visibility !== undefined) updateData.visibility = body.visibility
    if (body.color !== undefined) updateData.color = body.color
    if (body.highlight !== undefined) updateData.highlight = body.highlight
    if (body.locked !== undefined && membership.role === "HEAD_COACH") {
      updateData.locked = body.locked
    }
    // Allow updating linkage fields
    if (body.linkedChatId !== undefined) updateData.linkedChatId = body.linkedChatId
    if (body.linkedAnnouncementId !== undefined) updateData.linkedAnnouncementId = body.linkedAnnouncementId

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
      include: {
        creator: { select: { name: true, email: true } },
      },
    })

    // Create update feed entry
    await prisma.updatesFeed.create({
      data: {
        teamId,
        type: "event_updated",
        title: `Event updated: ${event.title}`,
        description: `Changes made to ${event.title}`,
        linkType: "event",
        linkId: event.id,
        urgency: "normal",
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "event_updated",
        metadata: {
          eventId: event.id,
          changes: body,
        },
      },
    })

    // Log event update
    logEventAction("event_updated", {
      userId: session.user.id,
      teamId,
      role: membership.role,
      eventId: event.id,
      eventType: event.eventType,
      title: event.title,
    })

    // Create notifications for event update (exclude updater)
    await createNotifications({
      type: "event_updated",
      teamId,
      title: `Event updated: ${event.title}`,
      body: `Changes were made to ${event.title}`,
      linkUrl: `/dashboard/schedule`,
      linkType: "event",
      linkId: event.id,
      metadata: {
        eventId: event.id,
        eventType: event.eventType,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
      },
      excludeUserIds: [session.user.id], // Don't notify the updater
    })

    return NextResponse.json(event)
  } catch (error: any) {
    console.error("Update event error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/teams/[teamId]/calendar/events/[eventId]
export async function DELETE(
  request: Request,
  { params }: { params: { teamId: string; eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, eventId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check billing state - read-only mode blocks event deletion
    await requireBillingPermission(teamId, "editEvents", prisma)

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event || event.teamId !== teamId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get full membership details for permission checking
    const fullMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    })

    if (!fullMembership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 })
    }

    // Hierarchical permission check per BRAIK_MASTER_INTENT.md
    // Head Coach can remove all events
    // Assistant coaches can only remove their own events
    const canRemove = await canRemoveEvent(
      session.user.id,
      {
        id: event.id,
        teamId: event.teamId,
        createdBy: event.createdBy,
        scopedUnit: event.scopedUnit as "OFFENSE" | "DEFENSE" | "SPECIAL_TEAMS" | null,
        coordinatorType: event.coordinatorType as "OC" | "DC" | "ST" | null,
      },
      {
        role: membership.role,
        permissions: fullMembership.permissions,
      }
    )

    if (!canRemove) {
      logPermissionDenial({
        userId: session.user.id,
        teamId,
        role: membership.role,
        reason: "Insufficient permissions to remove this event (hierarchical check failed)",
      })
      return NextResponse.json(
        { error: "You don't have permission to remove this event" },
        { status: 403 }
      )
    }

    await prisma.event.delete({
      where: { id: eventId },
    })

    // Create update feed entry
    await prisma.updatesFeed.create({
      data: {
        teamId,
        type: "event_canceled",
        title: `Event canceled: ${event.title}`,
        description: `The event "${event.title}" has been canceled`,
        linkType: "event",
        linkId: eventId,
        urgency: "high",
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "event_deleted",
        metadata: {
          eventId,
          title: event.title,
        },
      },
    })

    // Log event deletion
    logEventAction("event_deleted", {
      userId: session.user.id,
      teamId,
      role: membership.role,
      eventId,
      eventType: event.eventType,
      title: event.title,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete event error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
