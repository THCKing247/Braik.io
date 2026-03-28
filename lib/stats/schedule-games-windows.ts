import { addDays, addMonths, addYears, endOfDay, startOfDay, subDays, subMonths, subYears } from "date-fns"

export type ScheduleGamesWindow = { startIso: string; endIso: string }

/**
 * Three contiguous windows so merged results cover long team history without one huge query.
 * - prev: deep history up to the day before `main` starts
 * - main: recent past through near-future (primary UX window)
 * - next: far-future games after `main` ends
 */
export function getScheduleGamesWindows(now: Date = new Date()): {
  prev: ScheduleGamesWindow
  main: ScheduleGamesWindow
  next: ScheduleGamesWindow
} {
  const mainStart = startOfDay(subMonths(now, 30))
  const mainEnd = endOfDay(addMonths(now, 18))

  const prevStart = startOfDay(subYears(now, 25))
  const prevEnd = endOfDay(subDays(mainStart, 1))

  const nextStart = startOfDay(addDays(mainEnd, 1))
  const nextEnd = endOfDay(addYears(now, 15))

  return {
    prev: { startIso: prevStart.toISOString(), endIso: prevEnd.toISOString() },
    main: { startIso: mainStart.toISOString(), endIso: mainEnd.toISOString() },
    next: { startIso: nextStart.toISOString(), endIso: nextEnd.toISOString() },
  }
}
