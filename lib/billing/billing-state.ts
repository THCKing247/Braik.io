/**
 * Billing & Season Lifecycle State Machine
 *
 * Implements per-season billing model with:
 * - Pre-season grace period (June/July) with full access
 * - Payment due by first game week
 * - Non-payment → read-only mode
 * - AI premium feature gating
 *
 * ─── DEV MODE ──────────────────────────────────────────────────────────────
 * BILLING_ENFORCED = false  →  all billing checks are bypassed and every team
 * is treated as fully paid + active.  Flip to true when Stripe is integrated
 * and you are ready to enforce payment at launch.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { logBillingStateTransition } from "@/lib/audit/structured-logger"

/** Set to true when Stripe is integrated and billing enforcement is ready. */
const BILLING_ENFORCED = false

/** Exposed for coach settings / Phase 1 summary (read-only). */
export function isBillingLifecycleEnforced(): boolean {
  return BILLING_ENFORCED
}

/** Roster seat caps (active `players` rows) are enforced in API via `lib/billing/roster-entitlement.ts`
 *  using `teams.roster_slot_limit` / `programs.roster_slot_limit`. Stripe webhook placeholder: `app/api/stripe/webhook/route.ts`.
 */

/** Full-access billing state returned whenever billing is not enforced. */
const DEV_FULL_ACCESS: BillingState = {
  status: "ACTIVE",
  isReadOnly: false,
  canCreate: true,
  canModify: true,
  canMessage: true,
  canEditEvents: true,
  canEditDepthCharts: true,
  canUseAI: true,
  canView: true,
  reason: "Dev mode — billing not enforced",
}

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
  if (!BILLING_ENFORCED) return "ACTIVE"
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
  if (!BILLING_ENFORCED) return DEV_FULL_ACCESS
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
 * Get billing state for a team (Supabase)
 */
export async function getTeamBillingState(teamId: string): Promise<BillingState> {
  if (!BILLING_ENFORCED) return DEV_FULL_ACCESS
  const { getSupabaseServer } = await import("@/src/lib/supabaseServer")
  const supabase = getSupabaseServer()

  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .maybeSingle()

  if (!team) {
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

  const t = team as Record<string, unknown>
  const now = new Date()
  const seasonStart =
    (typeof t.season_start === "string" || t.season_start instanceof Date)
      ? new Date(t.season_start as string)
      : new Date(now.getFullYear(), 6, 1)
  const seasonEnd =
    (typeof t.season_end === "string" || t.season_end instanceof Date)
      ? new Date(t.season_end as string)
      : new Date(now.getFullYear() + 1, 5, 30)
  const context: SeasonBillingContext = {
    teamId: team.id,
    seasonYear: now.getFullYear(),
    seasonStart,
    seasonEnd,
    firstGameWeekDate: null,
    paymentDueDate:
      (typeof t.subscription_due_date === "string" || t.subscription_due_date instanceof Date)
        ? new Date(t.subscription_due_date as string)
        : null,
    amountPaid: Number(t.amount_paid ?? 0),
    subscriptionAmount: Number(t.subscription_amount ?? 0),
    aiEnabled: Boolean(t.ai_enabled ?? true),
    aiDisabledByPlatform: Boolean(t.ai_disabled_by_platform ?? false),
    currentDate: now,
  }

  if (String(t.account_status ?? "").toUpperCase() === "LOCKED") {
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

  return getBillingState(context)
}

/**
 * Update account status on team based on current billing state
 * Call this after payment updates or game confirmations
 */
export async function syncTeamAccountStatus(teamId: string): Promise<AccountStatus> {
  const { getSupabaseServer } = await import("@/src/lib/supabaseServer")
  const supabase = getSupabaseServer()

  const { data: currentTeam } = await supabase
    .from("teams")
    .select("account_status")
    .eq("id", teamId)
    .maybeSingle()

  const fromStatus = (currentTeam as { account_status?: string })?.account_status || "UNKNOWN"
  const billingState = await getTeamBillingState(teamId)

  await supabase
    .from("teams")
    .update({ account_status: billingState.status })
    .eq("id", teamId)

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
export async function updateFirstGameWeekDate(seasonId: string): Promise<Date | null> {
  const { getSupabaseServer } = await import("@/src/lib/supabaseServer")
  const supabase = getSupabaseServer()

  const { data: games } = await supabase
    .from("games")
    .select("date")
    .eq("season_id", seasonId)
    .eq("confirmed_by_coach", true)
    .order("date", { ascending: true })
    .limit(1)

  if (!games?.length) {
    await supabase
      .from("seasons")
      .update({ first_game_week_date: null })
      .eq("id", seasonId)
    return null
  }

  const firstGameDate = new Date(games[0].date)
  await supabase
    .from("seasons")
    .update({ first_game_week_date: firstGameDate.toISOString() })
    .eq("id", seasonId)

  return firstGameDate
}

/**
 * Check if an action is allowed based on billing state
 * Throws an error if not allowed
 */
export async function requireBillingPermission(
  teamId: string,
  permission: "create" | "modify" | "message" | "editEvents" | "editDepthCharts" | "useAI" | "view"
): Promise<BillingState> {
  if (!BILLING_ENFORCED) return DEV_FULL_ACCESS
  const billingState = await getTeamBillingState(teamId)

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
