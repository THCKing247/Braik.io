import { getDefaultStatsGamesDateBounds } from "@/lib/stats/games-default-date-window"

export type ScheduleGamesRange = { startIso: string; endIso: string }

/**
 * Single bounded window for the team schedule page.
 * Week/month/list views all group this same list client-side — no extra fetches per view.
 *
 * Matches dashboard bootstrap games bounds so deferred-core can seed the schedule query cache.
 */
export function getSchedulePageGamesRange(now: Date = new Date()): ScheduleGamesRange {
  return getDefaultStatsGamesDateBounds(now)
}
