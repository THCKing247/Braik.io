/**
 * Billing & Season Lifecycle State Machine
 * 
 * Implements per-season billing model with:
 * - Pre-season grace period (June/July) with full access
 * - Payment due by first game week
 * - Non-payment → read-only mode
 * - AI premium feature gating
 */

import { logBillingStateTransition } from "./structured-logger"

export type AccountStatus = "ACTIVE" | "GRACE" | "READ_ONLY" | "LOCKED"

export interface BillingState {
  status: AccountStatus
  isReadOnly: boolean
  canCreate: boolean
  canModify: boolean
  canMessage: boolean
  canEditEvents: boolean
  canEditDepthCharts: boolean
  canUseAI: boolean
  canView: boolean // Always true except LOCKED
  reason?: string // Human-readable reason for current state
}

export interface SeasonBillingContext {
  teamId: string
  seasonYear: number
  seasonStart: Date
  seasonEnd: Date
  firstGameWeekDate: Date | null // Date of first game week
  paymentDueDate: Date | null
  amountPaid: number
  subscriptionAmount: number
  aiEnabled: boolean // AI premium feature enabled
  aiDisabledByPlatform: boolean // Platform Owner disabled AI
  currentDate: Date
}

/**
 * Determine account status based on billing context
 * 
 * State transitions:
 * - GRACE: Pre-season (June/July) OR before first game week
 * - ACTIVE: Payment complete and after grace period
 * - READ_ONLY: Payment due but not paid, after grace period
 * - LOCKED: Platform Owner action (manual override)
 */
export function calculateAccountStatus(context: SeasonBillingContext): AccountStatus {
  const { currentDate, firstGameWeekDate, paymentDueDate, amountPaid, subscriptionAmount } = context

  // Check if in grace period (June/July pre-season)
  const month = currentDate.getMonth() // 0-11, where 0 = January
  const isGracePeriod = month === 5 || month === 6 // June (5) or July (6)

  // If no first game week set yet, check if we're before season start + grace period
  if (!firstGameWeekDate) {
    // If in June/July, we're in grace period
    if (isGracePeriod) {
      return "GRACE"
    }
    // If before season start, still grace
    if (currentDate < context.seasonStart) {
      return "GRACE"
    }
  }

  // If first game week is set, check if we're before it
  if (firstGameWeekDate && currentDate < firstGameWeekDate) {
    return "GRACE"
  }

  // After grace period, check payment status
  const isPaid = amountPaid >= subscriptionAmount

  if (isPaid) {
    return "ACTIVE"
  } else {
    return "READ_ONLY"
  }
}

/**
 * Get billing state with all permissions
 */
export function getBillingState(context: SeasonBillingContext): BillingState {
  const status = calculateAccountStatus(context)
  const { aiEnabled, aiDisabledByPlatform } = context

  // Base permissions by status
  switch (status) {
    case "ACTIVE":
      return {
        status,
        isReadOnly: false,
        canCreate: true,
        canModify: true,
        canMessage: true,
        canEditEvents: true,
        canEditDepthCharts: true,
        canUseAI: aiEnabled && !aiDisabledByPlatform,
        canView: true,
        reason: "Account is active and fully paid",
      }

    case "GRACE":
      return {
        status,
        isReadOnly: false,
        canCreate: true,
        canModify: true,
        canMessage: true,
        canEditEvents: true,
        canEditDepthCharts: true,
        canUseAI: aiEnabled && !aiDisabledByPlatform,
        canView: true,
        reason: "Pre-season grace period - full access until first game week",
      }

    case "READ_ONLY":
      return {
        status,
        isReadOnly: true,
        canCreate: false,
        canModify: false,
        canMessage: false,
        canEditEvents: false,
        canEditDepthCharts: false,
        canUseAI: false, // AI is always premium
        canView: true,
        reason: "Payment required - account is in read-only mode",
      }

    case "LOCKED":
      return {
        status,
        isReadOnly: true,
        canCreate: false,
        canModify: false,
        canMessage: false,
        canEditEvents: false,
        canEditDepthCharts: false,
        canUseAI: false,
        canView: false,
        reason: "Account locked by Platform Owner",
      }

    default:
      // Fallback to READ_ONLY for safety
      return {
        status: "READ_ONLY",
        isReadOnly: true,
        canCreate: false,
        canModify: false,
        canMessage: false,
        canEditEvents: false,
        canEditDepthCharts: false,
        canUseAI: false,
        canView: true,
        reason: "Unknown status - defaulting to read-only",
      }
  }
}

/**
 * Get first game week date from season games
 * Returns the date of the first confirmed game, or null if no games
 */
export function getFirstGameWeekDate(games: Array<{ date: Date; confirmedByCoach: boolean }>): Date | null {
  const confirmedGames = games.filter(g => g.confirmedByCoach)
  if (confirmedGames.length === 0) {
    return null
  }

  // Sort by date and get the earliest
  const sortedGames = [...confirmedGames].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  return new Date(sortedGames[0].date)
}

/**
 * Calculate payment due date
 * Defaults to first game week date, or season start if no games
 */
export function calculatePaymentDueDate(
  firstGameWeekDate: Date | null,
  seasonStart: Date
): Date {
  return firstGameWeekDate || seasonStart
}

/**
 * Get billing state for a team
 * This is the main function to use in API routes and components
 */
export async function getTeamBillingState(
  teamId: string,
  prisma: any // PrismaClient type
): Promise<BillingState> {
  // Get team with season and games
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      seasons: {
        include: {
          games: {
            where: { confirmedByCoach: true },
            orderBy: { date: "asc" },
          },
        },
        orderBy: { year: "desc" },
        take: 1, // Get current season
      },
    },
  })

  if (!team) {
    // Return locked state if team not found
    return {
      status: "LOCKED",
      isReadOnly: true,
      canCreate: false,
      canModify: false,
      canMessage: false,
      canEditEvents: false,
      canEditDepthCharts: false,
      canUseAI: false,
      canView: false,
      reason: "Team not found",
    }
  }

  // Get current season (most recent)
  const currentSeason = team.seasons?.[0]

  // Calculate first game week date
  let firstGameWeekDate: Date | null = null
  if (currentSeason) {
    // Use cached value if available, otherwise calculate
    if (currentSeason.firstGameWeekDate) {
      firstGameWeekDate = new Date(currentSeason.firstGameWeekDate)
    } else if (currentSeason.games && currentSeason.games.length > 0) {
      firstGameWeekDate = getFirstGameWeekDate(
        currentSeason.games.map((g: any) => ({
          date: new Date(g.date),
          confirmedByCoach: g.confirmedByCoach,
        }))
      )
    }
  }

  // Build context
  const context: SeasonBillingContext = {
    teamId: team.id,
    seasonYear: currentSeason?.year || new Date().getFullYear(),
    seasonStart: new Date(team.seasonStart),
    seasonEnd: new Date(team.seasonEnd),
    firstGameWeekDate,
    paymentDueDate: team.subscriptionDueDate ? new Date(team.subscriptionDueDate) : null,
    amountPaid: team.amountPaid || 0,
    subscriptionAmount: team.subscriptionAmount || 0,
    aiEnabled: team.aiEnabled || false,
    aiDisabledByPlatform: team.aiDisabledByPlatform || false,
    currentDate: new Date(),
  }

  // If account status is manually set to LOCKED, respect that
  if (team.accountStatus === "LOCKED") {
    return {
      status: "LOCKED",
      isReadOnly: true,
      canCreate: false,
      canModify: false,
      canMessage: false,
      canEditEvents: false,
      canEditDepthCharts: false,
      canUseAI: false,
      canView: false,
      reason: "Account locked by Platform Owner",
    }
  }

  // Calculate and return billing state
  return getBillingState(context)
}

/**
 * Update account status on team based on current billing state
 * Call this after payment updates or game confirmations
 */
export async function syncTeamAccountStatus(
  teamId: string,
  prisma: any
): Promise<AccountStatus> {
  // Get current status before update
  const currentTeam = await prisma.team.findUnique({
    where: { id: teamId },
    select: { accountStatus: true },
  })
  const fromStatus = currentTeam?.accountStatus || "UNKNOWN"

  const billingState = await getTeamBillingState(teamId, prisma)
  
  // Update team's account status
  await prisma.team.update({
    where: { id: teamId },
    data: { accountStatus: billingState.status },
  })

  // Log state transition if it changed
  if (fromStatus !== billingState.status) {
    logBillingStateTransition({
      teamId,
      fromStatus,
      toStatus: billingState.status,
      reason: billingState.reason,
      metadata: {
        isReadOnly: billingState.isReadOnly,
        canUseAI: billingState.canUseAI,
      },
    })
  }

  return billingState.status
}

/**
 * Update first game week date in season when games are confirmed
 * This should be called when a game is confirmed
 */
export async function updateFirstGameWeekDate(
  seasonId: string,
  prisma: any
): Promise<Date | null> {
  // Get all confirmed games for this season
  const confirmedGames = await prisma.game.findMany({
    where: {
      seasonId,
      confirmedByCoach: true,
    },
    orderBy: { date: "asc" },
  })

  if (confirmedGames.length === 0) {
    // Clear firstGameWeekDate if no confirmed games
    await prisma.season.update({
      where: { id: seasonId },
      data: { firstGameWeekDate: null },
    })
    return null
  }

  const firstGameDate = new Date(confirmedGames[0].date)

  // Update season with first game week date
  await prisma.season.update({
    where: { id: seasonId },
    data: { firstGameWeekDate: firstGameDate },
  })

  return firstGameDate
}

/**
 * Check if an action is allowed based on billing state
 * Throws an error if not allowed
 */
export async function requireBillingPermission(
  teamId: string,
  permission: "create" | "modify" | "message" | "editEvents" | "editDepthCharts" | "useAI" | "view",
  prisma: any
): Promise<BillingState> {
  const billingState = await getTeamBillingState(teamId, prisma)

  const permissionMap = {
    create: billingState.canCreate,
    modify: billingState.canModify,
    message: billingState.canMessage,
    editEvents: billingState.canEditEvents,
    editDepthCharts: billingState.canEditDepthCharts,
    useAI: billingState.canUseAI,
    view: billingState.canView,
  }

  if (!permissionMap[permission]) {
    throw new Error(
      `Action not allowed: ${billingState.reason || "Account is in ${billingState.status} status"}`
    )
  }

  return billingState
}
