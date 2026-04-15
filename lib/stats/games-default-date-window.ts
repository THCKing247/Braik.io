import { addMonths, endOfDay, startOfDay, subMonths } from "date-fns"

/**
 * Default bounds for server-side games queries when the client does not pass dates.
 * Keeps index scans on (team_id, game_date) bounded instead of reading full team history.
 */
export const GAMES_DEFAULT_WINDOW_MONTHS_PAST = 6
export const GAMES_DEFAULT_WINDOW_MONTHS_FUTURE = 36

export function getDefaultStatsGamesDateBounds(now: Date = new Date()): { startIso: string; endIso: string } {
  const start = startOfDay(subMonths(now, GAMES_DEFAULT_WINDOW_MONTHS_PAST))
  const end = endOfDay(addMonths(now, GAMES_DEFAULT_WINDOW_MONTHS_FUTURE))
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}
