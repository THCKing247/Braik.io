import { ROLES, type Role } from "@/lib/auth/roles"

// Role-based token weight multipliers
const ROLE_WEIGHTS: Record<Role, number> = {
  HEAD_COACH: 1.0,
  ASSISTANT_COACH: 0.75, // Coordinators and position coaches
  ATHLETIC_DIRECTOR: 1.0,
  PLAYER: 0.25,
  PARENT: 0.25,
  SCHOOL_ADMIN: 1.0,
}

// Default usage limits (per season)
const DEFAULT_USAGE_LIMIT = 10000 // weighted tokens per season
const SOFT_CAP_THRESHOLD = 0.8 // 80% of limit

export interface AIUsageStatus {
  tokensUsed: number
  tokensLimit: number
  usagePercentage: number
  isNearLimit: boolean
  isAtLimit: boolean
  mode: "full" | "suggestion_only" | "disabled"
}

export interface RoleContext {
  role: Role
  positionGroups?: string[]
  unit?: "OFFENSE" | "DEFENSE" | "SPECIAL_TEAMS"
  isHeadCoach: boolean
  isCoordinator: boolean
  isPositionCoach: boolean
}

/**
 * Get or create AI usage record for a team/season
 */
export async function getOrCreateAIUsage(_teamId: string, _seasonYear: number = new Date().getFullYear()) {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

/**
 * Record AI usage for a request
 */
export async function recordAIUsage(
  _teamId: string,
  _userId: string,
  _role: Role,
  _tokensUsed: number,
  _actionType?: string,
  _seasonYear: number = new Date().getFullYear()
) {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

/**
 * Get current AI usage status for a team
 */
export async function getAIUsageStatus(
  _teamId: string,
  _usageLimit: number = DEFAULT_USAGE_LIMIT,
  _seasonYear: number = new Date().getFullYear()
): Promise<AIUsageStatus> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

/**
 * Check if AI is enabled for a team
 */
export async function isAIEnabled(_teamId: string): Promise<{ enabled: boolean; reason?: string }> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

/**
 * Get role-weighted context for AI prompts
 */
export function getRoleContext(membership: { role: Role; positionGroups?: any; permissions?: any }): RoleContext {
  const role = membership.role
  const positionGroups = Array.isArray(membership.positionGroups) ? membership.positionGroups : undefined

  // Determine if coordinator (OC, DC, ST)
  const isCoordinator =
    role === ROLES.ASSISTANT_COACH &&
    !!(positionGroups?.includes("OC") || positionGroups?.includes("DC") || positionGroups?.includes("ST"))

  // Determine unit from position groups
  let unit: "OFFENSE" | "DEFENSE" | "SPECIAL_TEAMS" | undefined
  if (positionGroups?.includes("OC")) unit = "OFFENSE"
  else if (positionGroups?.includes("DC")) unit = "DEFENSE"
  else if (positionGroups?.includes("ST")) unit = "SPECIAL_TEAMS"

  return {
    role,
    positionGroups,
    unit,
    isHeadCoach: role === ROLES.HEAD_COACH,
    isCoordinator,
    isPositionCoach: role === ROLES.ASSISTANT_COACH && !isCoordinator,
  }
}

/**
 * Build role-scoped context string for AI system prompt
 */
export function buildRoleScopedContext(
  roleContext: RoleContext,
  team: { name: string; sport: string; seasonName: string }
): string {
  let context = `You are an AI assistant for ${team.name} (${team.sport}), ${team.seasonName} season.\n`
  context += `Current user role: ${roleContext.role}\n\n`

  if (roleContext.isHeadCoach) {
    context += `You have full administrative authority within this program. You can:\n`
    context += `- Create and manage all events, announcements, and messages\n`
    context += `- Modify roster and depth charts\n`
    context += `- Approve AI-generated actions\n`
    context += `- Access all team data\n\n`
  } else if (roleContext.isCoordinator) {
    context += `You are a coordinator (${roleContext.unit}). You can:\n`
    context += `- Create and manage events scoped to your unit (${roleContext.unit})\n`
    context += `- Send messages to players in your unit\n`
    context += `- Edit depth charts within your unit\n`
    context += `- Manage position coaches beneath you\n`
    context += `- You CANNOT create parent announcements or modify roster\n\n`
  } else if (roleContext.isPositionCoach) {
    context += `You are a position coach. You can:\n`
    context += `- Create events scoped to your position group: ${roleContext.positionGroups?.join(", ") || "N/A"}\n`
    context += `- Send messages to your players\n`
    context += `- Edit depth chart positions for your group\n`
    context += `- You CANNOT access parents or other units\n`
    context += `- You CANNOT create parent announcements or modify roster\n\n`
  } else if (roleContext.role === ROLES.PLAYER) {
    context += `You are a player. You can:\n`
    context += `- View calendar events relevant to you\n`
    context += `- Message coaches (within hierarchy)\n`
    context += `- View depth charts (read-only)\n`
    context += `- You CANNOT modify any data or create events\n\n`
  } else if (roleContext.role === ROLES.PARENT) {
    context += `You are a parent. You can:\n`
    context += `- View Head Coach events\n`
    context += `- View announcements\n`
    context += `- View message threads involving your child (read-only)\n`
    context += `- You CANNOT modify any data or create events\n\n`
  }

  context += `IMPORTANT RULES:\n`
  context += `- Parent announcements: ONLY Head Coach can create, ALWAYS requires explicit confirmation\n`
  context += `- Roster modifications: ALWAYS require Head Coach approval\n`
  context += `- Other actions may execute without confirmation but must be reversible\n`
  context += `- Always respect role hierarchy and scoping\n`

  return context
}

/**
 * Determine if an action requires approval
 */
export function requiresApproval(actionType: string, roleContext: RoleContext): boolean {
  // Parent announcements always require approval (and only Head Coach can create)
  if (actionType === "create_parent_announcement") {
    return true
  }

  // Roster modifications always require approval
  if (actionType === "modify_roster" || actionType === "add_player" || actionType === "remove_player" || actionType === "update_player") {
    return true
  }

  // Bulk operations require approval
  if (actionType === "bulk_create_events" || actionType === "bulk_update_events") {
    return true
  }

  // Depth chart modifications that affect roster require approval
  if (actionType === "modify_depth_chart" && !roleContext.isHeadCoach) {
    return true
  }

  return false
}

/**
 * Get role weight for usage calculation
 */
export function getRoleWeight(role: Role): number {
  return ROLE_WEIGHTS[role] || 0.5
}
