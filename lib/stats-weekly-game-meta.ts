/** Shared vocabulary for weekly stat row game metadata (aligned with `games` where applicable). */

export const WEEKLY_ENTRY_GAME_TYPES = ["regular", "playoff", "scrimmage", "tournament"] as const
export const WEEKLY_ENTRY_GAME_RESULTS = ["win", "loss", "tie"] as const

export type WeeklyEntryGameType = (typeof WEEKLY_ENTRY_GAME_TYPES)[number]
export type WeeklyEntryGameResult = (typeof WEEKLY_ENTRY_GAME_RESULTS)[number]

export function normalizeWeeklyGameTypeInput(raw: string | undefined | null): string | null {
  if (raw == null) return null
  const t = String(raw).trim().toLowerCase()
  if (!t) return null
  if (WEEKLY_ENTRY_GAME_TYPES.includes(t as WeeklyEntryGameType)) return t
  return null
}

export function normalizeWeeklyResultInput(raw: string | undefined | null): string | null {
  if (raw == null) return null
  const t = String(raw).trim().toLowerCase()
  if (!t) return null
  if (WEEKLY_ENTRY_GAME_RESULTS.includes(t as WeeklyEntryGameResult)) return t
  return null
}
