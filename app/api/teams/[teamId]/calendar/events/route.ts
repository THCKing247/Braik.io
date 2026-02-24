import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { requireBillingPermission } from "@/lib/billing-state"
import { determineEventScoping, getCoordinatorType, getCoordinatorUnit, getUnitForPositionGroup } from "@/lib/calendar-hierarchy"
import { createNotifications } from "@/lib/notifications"

// GET /api/teams/[teamId]/calendar/events
export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("start")
    const endDate = searchParams.get("end")
    const eventType = searchParams.get("eventType")

    // Check user has access to team
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get full membership details for filtering
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

    // Build base query
    const where: any = { teamId }
    
    if (startDate && endDate) {
      where.start = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }
    
    if (eventType) {
      where.eventType = eventType
    }

    // Hierarchical visibility filtering per BRAIK_MASTER_INTENT.md
    // First, fetch all events with basic filters
    const baseWhere: any = { teamId }
    
    if (startDate && endDate) {
      baseWhere.start = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }
    
    if (eventType) {
      baseWhere.eventType = eventType
    }

    // Apply visibility filter based on role
    if (membership.role === "PLAYER" || membership.role === "PARENT") {
      baseWhere.visibility = {
        in: ["TEAM", "PARENTS_AND_TEAM"],
      }
    } else if (membership.role === "ASSISTANT_COACH") {
      baseWhere.visibility = {
        in: ["COACHES_ONLY", "TEAM", "PARENTS_AND_TEAM"],
      }
    }
    // HEAD_COACH sees all visibility levels

    // Fetch all potentially relevant events
    let events = await prisma.event.findMany({
      where: baseWhere,
      include: {
        creator: { select: { name: true, email: true } },
        rsvps: {
          include: {
            player: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { start: "asc" },
    })

    // Apply hierarchical scoping filters in memory
    if (membership.role === "HEAD_COACH") {
      // Head Coach sees all events (no filtering needed)
    } else if (membership.role === "PARENT") {
      // Parents can only view Head Coach events (no scoping)
      const headCoachUsers = await prisma.membership.findMany({
        where: {
          teamId,
          role: "HEAD_COACH",
        },
        select: { userId: true },
      })
      const headCoachUserIds = new Set(headCoachUsers.map((m) => m.userId))
      
      events = events.filter((event) => {
        // Must be created by Head Coach
        if (!headCoachUserIds.has(event.createdBy)) return false
        // Must have no scoping (entire program events)
        return (
          !event.scopedUnit &&
          !event.scopedPositionGroups &&
          !event.scopedPlayerIds
        )
      })
    } else if (membership.role === "PLAYER") {
      // Players see events scoped to them
      const player = await prisma.player.findFirst({
        where: {
          teamId,
          userId: session.user.id,
        },
      })
      
      if (!player) {
        events = []
      } else {
        const playerUnit = getUnitForPositionGroup(player.positionGroup)
        
        events = events.filter((event) => {
          // Events with no scoping (Head Coach events for entire program)
          if (
            !event.scopedUnit &&
            !event.scopedPositionGroups &&
            !event.scopedPlayerIds
          ) {
            return true
          }
          
          // Events scoped to player's unit
          if (playerUnit && event.scopedUnit === playerUnit) {
            return true
          }
          
          // Events scoped to player's position group
          if (player.positionGroup && event.scopedPositionGroups) {
            const scopedGroups = event.scopedPositionGroups as string[]
            if (Array.isArray(scopedGroups) && scopedGroups.includes(player.positionGroup)) {
              return true
            }
          }
          
          // Events specifically scoped to this player
          if (event.scopedPlayerIds) {
            const scopedIds = event.scopedPlayerIds as string[]
            if (Array.isArray(scopedIds) && scopedIds.includes(player.id)) {
              return true
            }
          }
          
          return false
        })
      }
    } else if (membership.role === "ASSISTANT_COACH") {
      // Assistant coaches see events based on their scope
      const coordinatorType = getCoordinatorType({ permissions: fullMembership.permissions })
      const positionGroups = fullMembership.positionGroups as string[] | null
      
      if (coordinatorType) {
        // Coordinator sees events for their unit
        const coordinatorUnit = getCoordinatorUnit(coordinatorType)
        
        events = events.filter((event) => {
          // Events with no scoping (Head Coach events)
          if (
            !event.scopedUnit &&
            !event.scopedPositionGroups &&
            !event.scopedPlayerIds
          ) {
            return true
          }
          // Events scoped to their unit
          return event.scopedUnit === coordinatorUnit
        })
      } else if (positionGroups && positionGroups.length > 0) {
        // Position coach sees events for their position groups
        const positionGroupSet = new Set(positionGroups)
        
        events = events.filter((event) => {
          // Events with no scoping (Head Coach events)
          if (
            !event.scopedUnit &&
            !event.scopedPositionGroups &&
            !event.scopedPlayerIds
          ) {
            return true
          }
          // Events scoped to their position groups
          if (event.scopedPositionGroups) {
            const scopedGroups = event.scopedPositionGroups as string[]
            if (Array.isArray(scopedGroups)) {
              return scopedGroups.some((pg) => positionGroupSet.has(pg))
            }
          }
          return false
        })
      }
      // Assistant coach with no position groups - see all (shouldn't happen)
    }

    return NextResponse.json(events)
  } catch (error: any) {
    console.error("Calendar events error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/teams/[teamId]/calendar/events
export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json()
    const {
      eventType,
      title,
      description,
      start,
      end,
      location,
      visibility,
      color,
      highlight,
      linkedChatId,
      linkedAnnouncementId,
    } = body

    // Permission checks - Players and parents cannot create events
    if (membership.role === "PLAYER" || membership.role === "PARENT") {
      return NextResponse.json(
        { error: "You don't have permission to create events" },
        { status: 403 }
      )
    }

    // Check billing state - read-only mode blocks event creation
    await requireBillingPermission(teamId, "editEvents", prisma)

    // Get full membership details for scoping
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

    // Determine hierarchical event scoping per BRAIK_MASTER_INTENT.md
    const positionGroups = fullMembership.positionGroups as string[] | null
    const scoping = await determineEventScoping(
      teamId,
      membership.role,
      fullMembership.permissions,
      positionGroups
    )

    // Check calendar settings for assistant coaches (legacy support)
    if (membership.role === "ASSISTANT_COACH") {
      const settings = await prisma.calendarSettings.findUnique({
        where: { teamId },
      })

      if (settings) {
        // Assistants can only add MEETING by default
        if (eventType === "MEETING" && !settings.assistantsCanAddMeetings) {
          return NextResponse.json(
            { error: "You don't have permission to add meetings" },
            { status: 403 }
          )
        }

        // Check if assistant can add practices
        if (eventType === "PRACTICE" && !settings.assistantsCanAddPractices) {
          return NextResponse.json(
            { error: "You don't have permission to add practices" },
            { status: 403 }
          )
        }

        // Assistants cannot add GAME or CUSTOM unless explicitly allowed
        if (eventType === "GAME" || eventType === "CUSTOM") {
          return NextResponse.json(
            { error: "You don't have permission to add this event type" },
            { status: 403 }
          )
        }
      }
    }

    const event = await prisma.event.create({
      data: {
        teamId,
        eventType: eventType || "CUSTOM",
        title,
        description: description || null,
        start: new Date(start),
        end: new Date(end),
        location: location || null,
        visibility: visibility || "TEAM",
        color: color || null,
        highlight: highlight || false,
        createdBy: session.user.id,
        // Hierarchical scoping fields
        scopedPlayerIds: scoping.scopedPlayerIds ?? Prisma.JsonNull,
        scopedPositionGroups: scoping.scopedPositionGroups ?? Prisma.JsonNull,
        scopedUnit: scoping.scopedUnit,
        coordinatorType: scoping.coordinatorType,
        // Event linkage
        linkedChatId: linkedChatId || null,
        linkedAnnouncementId: linkedAnnouncementId || null,
      },
      include: {
        creator: { select: { name: true, email: true } },
      },
    })

    // Create update feed entry
    await prisma.updatesFeed.create({
      data: {
        teamId,
        type: "event_created",
        title: `New ${eventType?.toLowerCase() || "event"}: ${title}`,
        description: `Scheduled for ${new Date(start).toLocaleDateString()}`,
        linkType: "event",
        linkId: event.id,
        urgency: highlight ? "high" : "normal",
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "event_created",
        metadata: {
          eventId: event.id,
          eventType,
          title,
          start,
        },
      },
    })

    // Create notifications for event creation (exclude creator)
    await createNotifications({
      type: "event_created",
      teamId,
      title: `New ${eventType?.toLowerCase() || "event"}: ${title}`,
      body: `Scheduled for ${new Date(start).toLocaleDateString()} at ${new Date(start).toLocaleTimeString()}`,
      linkUrl: `/dashboard/schedule`,
      linkType: "event",
      linkId: event.id,
      metadata: {
        eventId: event.id,
        eventType: event.eventType,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        location: event.location,
      },
      excludeUserIds: [session.user.id], // Don't notify the creator
    })

    return NextResponse.json(event)
  } catch (error: any) {
    console.error("Create event error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
