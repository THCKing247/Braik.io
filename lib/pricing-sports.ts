/**
 * Sport-based minimum roster sizes for Braik pricing.
 * Used by the team price calculator to enforce minimum roster per sport.
 */
export const SPORT_MIN_ROSTERS: Record<string, number> = {
  Football: 40,
  Basketball: 10,
  Baseball: 12,
  Softball: 12,
  Soccer: 14,
  Volleyball: 10,
  Lacrosse: 15,
  Hockey: 12,
  Wrestling: 10,
  "Track & Field": 20,
  "Cross Country": 10,
  Other: 10,
} as const

export const SPORT_OPTIONS = Object.keys(SPORT_MIN_ROSTERS) as (keyof typeof SPORT_MIN_ROSTERS)[]

export function getSportMinRoster(sport: string): number {
  return SPORT_MIN_ROSTERS[sport] ?? SPORT_MIN_ROSTERS.Other
}
