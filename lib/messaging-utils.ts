import { prisma } from "./prisma"
import { isHighSchoolTeam } from "./messaging-permissions"
import { getParentAccessiblePlayerIds } from "./data-filters"

/**
 * Ensure General Chat thread exists for a team
 * This should be called when a team is created or when needed
 */
export async function ensureGeneralChatThread(teamId: string): Promise<string> {
  // Check if General Chat already exists
  const existing = await prisma.messageThread.findUnique({
    where: {
      teamId_threadType: {
        teamId,
        threadType: "GENERAL",
      },
    },
  })

  if (existing) {
    return existing.id
  }

  // Get team info
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      organization: true,
      memberships: {
        include: {
          user: {
            select: { id: true },
          },
        },
      },
    },
  })

  if (!team) {
    throw new Error("Team not found")
  }

  // Get Head Coach as creator (or first coach if no Head Coach)
  const headCoach = team.memberships.find(m => m.role === "HEAD_COACH")
  const creatorId = headCoach?.userId || team.memberships.find(m => m.role === "ASSISTANT_COACH")?.userId

  if (!creatorId) {
    throw new Error("No coach found to create General Chat")
  }

  // Create General Chat with all team members as participants
  const generalChat = await prisma.messageThread.create({
    data: {
      teamId,
      subject: "General Chat",
      threadType: "GENERAL",
      createdBy: creatorId,
      participants: {
        create: team.memberships.map(m => ({
          userId: m.userId,
          readOnly: false,
        })),
      },
    },
  })

  // For HS teams, add parents as read-only participants
  const isHS = isHighSchoolTeam(team.organization.type)
  if (isHS) {
    const playerMemberships = team.memberships.filter(m => m.role === "PLAYER")
    const playerUserIds = playerMemberships.map(m => m.userId)

    if (playerUserIds.length > 0) {
      const players = await prisma.player.findMany({
        where: {
          teamId,
          userId: { in: playerUserIds },
        },
        select: { id: true },
      })

      // Find all parents linked to these players
      const guardianLinks = await prisma.guardianPlayer.findMany({
        where: {
          playerId: { in: players.map(p => p.id) },
        },
        include: {
          guardian: {
            select: { userId: true },
          },
        },
      })

      const parentUserIds = [...new Set(guardianLinks.map(gl => gl.guardian.userId))]

      // Add parents as read-only participants
      if (parentUserIds.length > 0) {
        await prisma.threadParticipant.createMany({
          data: parentUserIds.map(userId => ({
            threadId: generalChat.id,
            userId,
            readOnly: true,
          })),
          skipDuplicates: true,
        })
      }
    }
  }

  return generalChat.id
}

/**
 * Ensure Parent + Player + Head Coach shared chat exists for a specific player
 * This creates a thread with the player, their parents, and the Head Coach
 */
export async function ensureParentPlayerCoachChat(
  teamId: string,
  playerUserId: string
): Promise<string> {
  // Get team info
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      organization: true,
    },
  })

  if (!team) {
    throw new Error("Team not found")
  }

  const isHS = isHighSchoolTeam(team.organization.type)
  if (!isHS) {
    throw new Error("Parent+Player+Coach chat only available for high school teams")
  }

  // Get player
  const player = await prisma.player.findFirst({
    where: {
      teamId,
      userId: playerUserId,
    },
  })

  if (!player) {
    throw new Error("Player not found")
  }

  // Get Head Coach
  const headCoach = await prisma.membership.findFirst({
    where: {
      teamId,
      role: "HEAD_COACH",
    },
  })

  if (!headCoach) {
    throw new Error("Head Coach not found")
  }

  // Get parents linked to this player
  const guardianLinks = await prisma.guardianPlayer.findMany({
    where: {
      playerId: player.id,
    },
    include: {
      guardian: {
        select: { userId: true },
      },
    },
  })

  const parentUserIds = guardianLinks.map(gl => gl.guardian.userId)

  // Check if thread already exists
  const existingThreads = await prisma.messageThread.findMany({
    where: {
      teamId,
      threadType: "CUSTOM",
      participants: {
        every: {
          userId: {
            in: [playerUserId, headCoach.userId, ...parentUserIds],
          },
        },
      },
    },
    include: {
      participants: true,
    },
  })

  // Find thread with exactly these participants
  const exactThread = existingThreads.find(thread => {
    const participantIds = new Set(thread.participants.map(p => p.userId))
    const requiredIds = new Set([playerUserId, headCoach.userId, ...parentUserIds])
    
    return (
      participantIds.size === requiredIds.size &&
      [...requiredIds].every(id => participantIds.has(id))
    )
  })

  if (exactThread) {
    return exactThread.id
  }

  // Create new thread
  const thread = await prisma.messageThread.create({
    data: {
      teamId,
      subject: `Chat: ${player.firstName} ${player.lastName}`,
      threadType: "CUSTOM",
      createdBy: headCoach.userId,
      participants: {
        create: [
          { userId: headCoach.userId, readOnly: false },
          { userId: playerUserId, readOnly: false },
          ...parentUserIds.map(userId => ({
            userId,
            readOnly: false, // Parents can participate in this shared chat
          })),
        ],
      },
    },
  })

  return thread.id
}
