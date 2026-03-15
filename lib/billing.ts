/**
 * Braik billing: Head Coach and Athletic Director plans.
 * Billing owner is always the coach/program or athletic department. Players do not pay for their own accounts.
 */

export const PLAN_TYPES = ["head_coach", "athletic_director"] as const
export type PlanType = (typeof PLAN_TYPES)[number]

/** Head Coach plan: varsity base + optional JV/Freshman + roster spots + assistant overage */
export const HEAD_COACH_PRICING = {
  varsityBase: 250,
  jvBase: 50,
  freshmanBase: 50,
  perRosterSpot: 10,
  freeAssistantCoachesBase: 3,
  freeAssistantPerJv: 1,
  freeAssistantPerFreshman: 1,
  perAssistantOverage: 10,
} as const

/** Athletic Director plan: flat annual */
export const ATHLETIC_DIRECTOR_PRICING = {
  flatAnnual: 6500,
} as const

export interface HeadCoachBillingInput {
  varsityRosterSpots: number
  hasJv: boolean
  jvRosterSpots: number
  hasFreshman: boolean
  freshmanRosterSpots: number
  assistantCoachCount: number
}

export interface HeadCoachBillingBreakdown {
  varsityBase: number
  jvBase: number
  freshmanBase: number
  varsityRosterCost: number
  jvRosterCost: number
  freshmanRosterCost: number
  freeAssistants: number
  assistantOverage: number
  assistantOverageCost: number
  total: number
}

/**
 * Free assistant coaches = 3 + (1 if JV exists) + (1 if Freshman exists).
 */
export function getFreeAssistantCoaches(input: {
  hasJv: boolean
  hasFreshman: boolean
}): number {
  let free = HEAD_COACH_PRICING.freeAssistantCoachesBase
  if (input.hasJv) free += HEAD_COACH_PRICING.freeAssistantPerJv
  if (input.hasFreshman) free += HEAD_COACH_PRICING.freeAssistantPerFreshman
  return free
}

/**
 * Compute Head Coach plan total and breakdown.
 */
export function computeHeadCoachBilling(input: HeadCoachBillingInput): HeadCoachBillingBreakdown {
  const { varsityBase, jvBase, freshmanBase, perRosterSpot, perAssistantOverage } = HEAD_COACH_PRICING
  const varsityBaseCost = varsityBase
  const jvBaseCost = input.hasJv ? jvBase : 0
  const freshmanBaseCost = input.hasFreshman ? freshmanBase : 0
  const varsityRosterCost = input.varsityRosterSpots * perRosterSpot
  const jvRosterCost = input.hasJv ? input.jvRosterSpots * perRosterSpot : 0
  const freshmanRosterCost = input.hasFreshman ? input.freshmanRosterSpots * perRosterSpot : 0
  const freeAssistants = getFreeAssistantCoaches({
    hasJv: input.hasJv,
    hasFreshman: input.hasFreshman,
  })
  const assistantOverage = Math.max(0, input.assistantCoachCount - freeAssistants)
  const assistantOverageCost = assistantOverage * perAssistantOverage
  const total =
    varsityBaseCost +
    jvBaseCost +
    freshmanBaseCost +
    varsityRosterCost +
    jvRosterCost +
    freshmanRosterCost +
    assistantOverageCost
  return {
    varsityBase: varsityBaseCost,
    jvBase: jvBaseCost,
    freshmanBase: freshmanBaseCost,
    varsityRosterCost,
    jvRosterCost,
    freshmanRosterCost,
    freeAssistants,
    assistantOverage,
    assistantOverageCost,
    total,
  }
}

/**
 * Athletic Director plan: flat annual.
 */
export function getAthleticDirectorAnnual(): number {
  return ATHLETIC_DIRECTOR_PRICING.flatAnnual
}
