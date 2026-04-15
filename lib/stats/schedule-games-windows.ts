import { addMonths, endOfDay, startOfDay, subMonths } from "date-fns"

export type ScheduleGamesRange = { startIso: string; endIso: string }

/**
 * Single bounded window for the team schedule page.
 * Week/month/list views all group this same list client-side — no extra fetches per view.
 *
 * Keeps the API scan index-friendly vs. unbounded history/future chunks.
 */
export function getSchedulePageGamesRange(now: Date = new Date()): ScheduleGamesRange {
  const start = startOfDay(subMonths(now, 36))
  const end = endOfDay(addMonths(now, 36))
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}
