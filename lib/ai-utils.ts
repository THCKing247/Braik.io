import { prisma } from "@/lib/prisma"

/** Role weight for usage: Head Coach 1.0, Assistant 0.75, Position 0.5, Player/Parent 0.25 */
const ROLE_WEIGHTS: Record<string, number> = {
  HEAD_COACH: 1.0,
  ASSISTANT_COACH: 0.75,
  PLAYER: 0.25,
  PARENT: 0.25,
}

const DEFAULT_ROLE_WEIGHT = 0.25

export type RoleContext = {
  role: string
  roleWeight: number
  isHeadCoach: boolean
  canPostAnnouncements: boolean
}

export type AIUsageStatus = {
  tokensUsed: number
  tokensLimit: number
  usagePercentage: number
  mode: "full" | "suggestion_only" | "disabled"
}

export type IsAIEnabledResult =
  | { enabled: true }
  | { enabled: false; reason: string }

/**
 * Get role weight for usage tracking (1.0 = Head Coach, 0.75 = Assistant, 0.5 = Position Coach, 0.25 = Player/Parent).
 */
export function getRoleWeight(role: string): number {
  return ROLE_WEIGHTS[role] ?? DEFAULT_ROLE_WEIGHT
}

/**
 * Build role context from membership for scoping and approval checks.
 */
export function getRoleContext(membership: { role: string }): RoleContext {
  const role = membership.role
  const roleWeight = getRoleWeight(role)
  return {
    role,
    roleWeight,
    isHeadCoach: role === "HEAD_COACH",
    canPostAnnouncements: role === "HEAD_COACH" || role === "ASSISTANT_COACH",
  }
}

/**
 * Build a role-scoped context string for the system prompt.
 */
export function buildRoleScopedContext(
  roleContext: RoleContext,
  team: { name?: string; sport?: string; seasonName?: string }
): string {
  const parts = [
    `You are assisting as ${roleContext.role}.`,
    roleContext.isHeadCoach
      ? "You have full permissions including parent announcements and roster changes."
      : "You can create events and send messages; parent announcements and roster changes require Head Coach approval.",
  ]
  if (team.name) parts.push(`Team: ${team.name}.`)
  if (team.sport) parts.push(`Sport: ${team.sport}.`)
  if (team.seasonName) parts.push(`Season: ${team.seasonName}.`)
  return parts.join(" ")
}

/**
 * Whether an action type requires Head Coach approval.
 */
export function requiresApproval(actionType: string, roleContext: RoleContext): boolean {
  if (roleContext.isHeadCoach) return false
  const approvalRequired = [
    "create_parent_announcement",
    "modify_roster",
    "parent_announcement",
    "roster",
  ]
  return approvalRequired.some((a) => actionType.toLowerCase().includes(a.toLowerCase()))
}

/**
 * Check if AI is enabled for the team (subscription, AI premium, platform flags).
 */
export async function isAIEnabled(teamId: string): Promise<IsAIEnabledResult> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { aiEnabled: true, aiDisabledByPlatform: true },
  })
  if (!team) return { enabled: false, reason: "team_not_found" }
  if (team.aiDisabledByPlatform) return { enabled: false, reason: "platform_disabled" }
  if (!team.aiEnabled) return { enabled: false, reason: "ai_premium_required" }
  return { enabled: true }
}

/**
 * Get current AI usage status for the team (aggregate tokens, limit, mode).
 */
export async function getAIUsageStatus(
  teamId: string,
  limit: number
): Promise<AIUsageStatus> {
  const currentYear = new Date().getFullYear()
  const aggregate = await prisma.aIUsage
    .findFirst({
      where: { teamId, seasonYear: currentYear },
    })
    .catch(() => null)

  const tokensUsed = aggregate?.tokensUsed ?? 0
  const usagePercentage = limit > 0 ? (tokensUsed / limit) * 100 : 0
  let mode: AIUsageStatus["mode"] = "full"
  if (usagePercentage >= 100) mode = "disabled"
  else if (usagePercentage >= 80) mode = "suggestion_only"

  return {
    tokensUsed,
    tokensLimit: limit,
    usagePercentage,
    mode,
  }
}

/**
 * Record one AI usage and update aggregate. Returns the usage record with roleWeight for response.
 */
export async function recordAIUsage(
  teamId: string,
  userId: string,
  role: string,
  rawTokens: number,
  actionType: string
): Promise<{ tokensUsed: number; rawTokens: number; roleWeight: number }> {
  const roleWeight = getRoleWeight(role)
  const weightedTokens = Math.round(rawTokens * roleWeight)
  const currentYear = new Date().getFullYear()

  await prisma.aIUsageRecord.create({
    data: {
      teamId,
      userId,
      tokensUsed: rawTokens,
      roleWeight,
      weightedTokens,
      actionType,
    },
  })

  await prisma.aIUsage.upsert({
    where: {
      teamId_seasonYear: { teamId, seasonYear: currentYear },
    },
    create: {
      teamId,
      seasonYear: currentYear,
      tokensUsed: weightedTokens,
      requestsCount: 1,
    },
    update: {
      tokensUsed: { increment: weightedTokens },
      requestsCount: { increment: 1 },
    },
  })

  return {
    tokensUsed: weightedTokens,
    rawTokens,
    roleWeight,
  }
}
