import { prisma } from "./prisma"

/**
 * Get player IDs that a parent can access (only their linked children)
 */
export async function getParentAccessiblePlayerIds(
  userId: string,
  teamId: string
): Promise<string[]> {
  const guardian = await prisma.guardian.findFirst({
    where: { userId },
    include: {
      playerLinks: {
        where: {
          player: {
            teamId,
          },
        },
        select: {
          playerId: true,
        },
      },
    },
  })

  if (!guardian) {
    return []
  }

  return guardian.playerLinks.map((link) => link.playerId)
}

/**
 * Get position groups that an assistant coach can access
 */
export function getAssistantCoachPositionGroups(positionGroups: any): string[] | null {
  if (!positionGroups || !Array.isArray(positionGroups)) {
    return null // null means no restrictions (shouldn't happen for assistants, but handle gracefully)
  }
  return positionGroups
}

/**
 * Check if a player's position group is accessible to an assistant coach
 */
export function canAssistantCoachAccessPlayer(
  playerPositionGroup: string | null,
  assistantPositionGroups: string[] | null
): boolean {
  // If no position groups restriction, allow access (shouldn't happen, but handle gracefully)
  if (!assistantPositionGroups || assistantPositionGroups.length === 0) {
    return true
  }

  // If player has no position group, deny access
  if (!playerPositionGroup) {
    return false
  }

  // Check if player's position group is in the allowed list
  return assistantPositionGroups.includes(playerPositionGroup)
}

/**
 * Build a where clause for filtering players based on role
 */
export async function buildPlayerFilter(
  userId: string,
  role: string,
  teamId: string,
  positionGroups?: string[] | null
): Promise<any> {
  const baseFilter: any = { teamId }

  if (role === "PARENT") {
    // Parents can only see their linked children
    const accessiblePlayerIds = await getParentAccessiblePlayerIds(userId, teamId)
    if (accessiblePlayerIds.length === 0) {
      // No linked children, return filter that matches nothing
      return { id: "no-access" }
    }
    return {
      ...baseFilter,
      id: {
        in: accessiblePlayerIds,
      },
    }
  } else if (role === "ASSISTANT_COACH" && positionGroups) {
    // Assistant coaches can only see players in their assigned position groups
    return {
      ...baseFilter,
      positionGroup: {
        in: positionGroups,
      },
    }
  }

  // HEAD_COACH and PLAYER see all players (or their own data)
  return baseFilter
}
