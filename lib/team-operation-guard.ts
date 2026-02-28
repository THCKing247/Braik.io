import { PrismaClient } from "@prisma/client"

export type TeamOperation = "write" | "ai" | "billing" | "view"

export class TeamOperationBlockedError extends Error {
  statusCode: number
  code: string
  details: Record<string, unknown>

  constructor(statusCode: number, code: string, message: string, details: Record<string, unknown>) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function toStructuredTeamAccessError(error: TeamOperationBlockedError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...error.details,
    },
  }
}

export async function requireTeamOperationAccess(
  teamId: string,
  operation: TeamOperation,
  prisma: PrismaClient
): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      teamStatus: true,
      subscriptionStatus: true,
      aiEnabled: true,
      aiDisabledByPlatform: true,
    },
  })

  if (!team) {
    throw new TeamOperationBlockedError(404, "TEAM_NOT_FOUND", "Team not found", { teamId, operation })
  }

  if (team.subscriptionStatus === "terminated") {
    throw new TeamOperationBlockedError(
      423,
      "TEAM_SUBSCRIPTION_TERMINATED",
      "Team access is locked because the subscription is terminated.",
      {
        teamId: team.id,
        operation,
        teamStatus: team.teamStatus,
        subscriptionStatus: team.subscriptionStatus,
      }
    )
  }

  if (operation === "billing" || operation === "view") {
    return
  }

  const suspended = team.teamStatus !== "active"
  if (suspended) {
    throw new TeamOperationBlockedError(
      403,
      "TEAM_SUSPENDED_WRITE_BLOCKED",
      "Team is suspended; write and AI operations are blocked.",
      {
        teamId: team.id,
        operation,
        teamStatus: team.teamStatus,
        subscriptionStatus: team.subscriptionStatus,
      }
    )
  }

  if (operation === "ai") {
    if (!team.aiEnabled || team.aiDisabledByPlatform) {
      throw new TeamOperationBlockedError(
        403,
        "TEAM_AI_DISABLED",
        "AI execution is disabled for this team.",
        {
          teamId: team.id,
          operation,
          aiEnabled: team.aiEnabled,
          aiDisabledByPlatform: team.aiDisabledByPlatform,
        }
      )
    }
  }
}
