import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MessagingManager } from "@/components/messaging-manager"
import { ensureGeneralChatThread } from "@/lib/messaging-utils"

export default async function MessagesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  })

  if (!membership) {
    redirect("/onboarding")
  }

  // Ensure General Chat exists
  try {
    await ensureGeneralChatThread(membership.teamId)
  } catch (error) {
    console.error("Error ensuring General Chat:", error)
  }

  // Load initial threads
  const threads = await prisma.messageThread.findMany({
    where: {
      teamId: membership.teamId,
      participants: {
        some: {
          userId: session.user.id,
        },
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
    orderBy: { updatedAt: "desc" },
  })

  // For parents (HS only), add read-only access to threads involving their children
  let accessibleThreads = threads
  if (membership.role === "PARENT") {
    const team = await prisma.team.findUnique({
      where: { id: membership.teamId },
      include: { organization: true },
    })

    if (team && team.organization.type === "school") {
      // Get accessible player IDs
      const accessiblePlayerIds = await prisma.guardianPlayer.findMany({
        where: {
          guardian: {
            userId: session.user.id,
          },
          player: {
            teamId: membership.teamId,
          },
        },
        include: {
          player: {
            select: { userId: true },
          },
        },
      })

      const childUserIds = accessiblePlayerIds
        .map(gl => gl.player.userId)
        .filter(Boolean) as string[]

      if (childUserIds.length > 0) {
        // Get threads where children are participants
        const childThreads = await prisma.messageThread.findMany({
          where: {
            teamId: membership.teamId,
            participants: {
              some: {
                userId: { in: childUserIds },
              },
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
          orderBy: { updatedAt: "desc" },
        })

        // Mark parent threads as read-only and merge
        const childThreadsWithReadOnly = childThreads.map(thread => {
          const isDirectParticipant = thread.participants.some(p => p.userId === session.user.id)
          return {
            ...thread,
            isReadOnly: !isDirectParticipant,
            canReply: isDirectParticipant,
          }
        })

        // Merge and deduplicate
        const threadMap = new Map(accessibleThreads.map(t => [t.id, t]))
        childThreadsWithReadOnly.forEach(t => {
          if (!threadMap.has(t.id)) {
            threadMap.set(t.id, t)
          }
        })

        accessibleThreads = Array.from(threadMap.values())
      }
    }
  }

  // Mark read-only status for all threads
  const threadsWithPermissions = accessibleThreads.map(thread => {
    const participant = thread.participants.find(p => p.userId === session.user.id)
    const isReadOnly = participant?.readOnly || false

    return {
      ...thread,
      isReadOnly,
      canReply: !isReadOnly,
    }
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Messages</h1>
        <p style={{ color: "#6B7280" }}>Team messaging and conversations</p>
      </div>
      <MessagingManager
        teamId={membership.teamId}
        userRole={membership.role}
        userId={session.user.id}
        initialThreads={threadsWithPermissions}
      />
    </div>
  )
}
