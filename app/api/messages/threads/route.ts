import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getParentAccessiblePlayerIds } from "@/lib/data-filters"
import { isHighSchoolTeam } from "@/lib/messaging-permissions"

/**
 * GET /api/messages/threads
 * List all threads the user has access to
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
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

    const userRole = membership.role as string
    const isHS = isHighSchoolTeam(membership.team.organization.type)

    // Get threads where user is a participant
    let threadIds: string[] = []

    if (userRole === "PARENT" && isHS) {
      // Parents (HS only): Get threads involving their children + General Chat + Parent+Player+HeadCoach threads
      const accessiblePlayerIds = await getParentAccessiblePlayerIds(session.user.id, teamId)
      
      // Get player user IDs from accessible player IDs
      const players = await prisma.player.findMany({
        where: {
          id: { in: accessiblePlayerIds },
          userId: { not: null },
        },
        select: { userId: true },
      })

      const childUserIds = players.map(p => p.userId).filter(Boolean) as string[]

      // Get threads where their children are participants
      const childThreads = childUserIds.length > 0 ? await prisma.threadParticipant.findMany({
        where: {
          userId: { in: childUserIds },
        },
        select: { threadId: true },
        distinct: ["threadId"],
      }) : []

      threadIds = childThreads.map(t => t.threadId)

      // Also include General Chat and any threads the parent is directly a participant in
      const parentThreads = await prisma.threadParticipant.findMany({
        where: { userId: session.user.id },
        select: { threadId: true },
        distinct: ["threadId"],
      })

      threadIds = [...new Set([...threadIds, ...parentThreads.map(t => t.threadId)])]
    } else {
      // For coaches and players: get threads they're participants in
      const participantThreads = await prisma.threadParticipant.findMany({
        where: { userId: session.user.id },
        select: { threadId: true },
        distinct: ["threadId"],
      })

      threadIds = participantThreads.map(t => t.threadId)
    }

    // Fetch threads with latest message info
    const threads = await prisma.messageThread.findMany({
      where: {
        id: { in: threadIds },
        teamId,
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
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            creator: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    // For parents, mark read-only status
    const threadsWithPermissions = threads.map(thread => {
      const participant = thread.participants.find(p => p.userId === session.user.id)
      const isReadOnly = participant?.readOnly || false

      return {
        ...thread,
        isReadOnly,
        canReply: !isReadOnly,
      }
    })

    return NextResponse.json(threadsWithPermissions)
  } catch (error: any) {
    console.error("Get threads error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
