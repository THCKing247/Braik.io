import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMessagingPermissions, getUserType, isHighSchoolTeam, validateThreadComposition } from "@/lib/messaging-permissions"
import { getParentAccessiblePlayerIds } from "@/lib/data-filters"
import { logThreadCreated, logPermissionDenial } from "@/lib/structured-logger"

/**
 * POST /api/messages/threads/create
 * Create a new thread (coaches only)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, subject, participantUserIds } = await request.json()

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    if (!Array.isArray(participantUserIds) || participantUserIds.length === 0) {
      return NextResponse.json({ error: "participantUserIds array is required" }, { status: 400 })
    }

    // Get user's membership and role
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        teamId,
      },
      include: {
        team: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this team" }, { status: 403 })
    }

    const userRole = membership.role as "HEAD_COACH" | "ASSISTANT_COACH" | "PLAYER" | "PARENT"
    const permissions = getMessagingPermissions(userRole)

    // Only coaches can create threads
    if (!permissions.canCreateThread()) {
      logPermissionDenial({
        userId: session.user.id,
        teamId,
        role: userRole,
        reason: "Only coaches can create threads",
      })
      return NextResponse.json(
        { error: "Only coaches can create threads" },
        { status: 403 }
      )
    }

    // Validate participant IDs are valid team members
    const participants = await prisma.membership.findMany({
      where: {
        teamId,
        userId: { in: participantUserIds },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (participants.length !== participantUserIds.length) {
      return NextResponse.json(
        { error: "Some participant IDs are invalid or not team members" },
        { status: 400 }
      )
    }

    // Validate thread composition
    const participantRoles = participants.map(p => ({
      role: p.role as "HEAD_COACH" | "ASSISTANT_COACH" | "PLAYER" | "PARENT",
      type: getUserType(p.role as "HEAD_COACH" | "ASSISTANT_COACH" | "PLAYER" | "PARENT"),
    }))

    const validation = validateThreadComposition(userRole, participantRoles)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      )
    }

    const isHS = isHighSchoolTeam(membership.team.organization.type)

    // Create thread
    const thread = await prisma.messageThread.create({
      data: {
        teamId,
        subject: subject || null,
        threadType: "CUSTOM",
        createdBy: session.user.id,
        participants: {
          create: [
            // Add creator as participant
            { userId: session.user.id, readOnly: false },
            // Add other participants
            ...participants
              .filter(p => p.userId !== session.user.id)
              .map(p => ({
                userId: p.userId,
                readOnly: false,
              })),
          ],
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    // For HS teams, add parents as read-only participants if their children are in the thread
    if (isHS) {
      const playerParticipants = participants.filter(
        p => p.role === "PLAYER"
      )

      if (playerParticipants.length > 0) {
        const playerIds = await prisma.player.findMany({
          where: {
            teamId,
            userId: { in: playerParticipants.map(p => p.userId) },
          },
          select: { id: true },
        })

        // Find all parents linked to these players
        const guardianLinks = await prisma.guardianPlayer.findMany({
          where: {
            playerId: { in: playerIds.map(p => p.id) },
          },
          include: {
            guardian: {
              select: { userId: true },
            },
          },
        })

        const parentUserIds = [...new Set(guardianLinks.map(gl => gl.guardian.userId))]

        // Add parents as read-only participants if not already participants
        if (parentUserIds.length > 0) {
          const existingParentParticipants = await prisma.threadParticipant.findMany({
            where: {
              threadId: thread.id,
              userId: { in: parentUserIds },
            },
            select: { userId: true },
          })

          const existingParentUserIds = new Set(existingParentParticipants.map(p => p.userId))
          const newParentUserIds = parentUserIds.filter(id => !existingParentUserIds.has(id))

          if (newParentUserIds.length > 0) {
            await prisma.threadParticipant.createMany({
              data: newParentUserIds.map(userId => ({
                threadId: thread.id,
                userId,
                readOnly: true,
              })),
            })
          }
        }
      }
    }

    // Fetch updated thread with all participants
    const updatedThread = await prisma.messageThread.findUnique({
      where: { id: thread.id },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    // Log thread created
    logThreadCreated({
      userId: session.user.id,
      teamId,
      role: userRole,
      threadId: thread.id,
      participantCount: updatedThread?.participants.length || 0,
    })

    return NextResponse.json(updatedThread)
  } catch (error: any) {
    console.error("Create thread error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
