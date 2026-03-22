/**
 * Shared helpers for team game rows (public.games) — schedule list + dashboard "next game".
 */

import { startOfDay } from "date-fns"

export type TeamGameRow = {
  id: string
  opponent: string
  gameDate: string
  location: string | null
  gameType: string | null
  result: string | null
  notes: string | null
  seasonYear: number | null
}

export type GameScheduleStatus = "scheduled" | "completed" | "postponed" | "cancelled"

const CANCELLED_RE = /\b(cancelled|canceled)\b/i
const POSTPONED_RE = /\bpostponed\b/i

export function inferScheduleStatus(game: Pick<TeamGameRow, "result" | "notes">): GameScheduleStatus {
  const notes = game.notes?.trim() ?? ""
  if (CANCELLED_RE.test(notes)) return "cancelled"
  if (POSTPONED_RE.test(notes)) return "postponed"
  const r = (game.result || "").toLowerCase()
  if (r === "win" || r === "loss" || r === "tie") return "completed"
  return "scheduled"
}

/** Best-effort home/away without a dedicated DB column. */
export function inferHomeAway(location: string | null): "home" | "away" | "tbd" {
  const loc = (location || "").trim()
  if (!loc) return "tbd"
  if (/^@/.test(loc) || /\baway\b/i.test(loc) || /^at\s+/i.test(loc)) return "away"
  if (/\bhome\b/i.test(loc) || /\bvs\.?\b/i.test(loc)) return "home"
  return "tbd"
}

export function isGameExcludedFromUpcoming(status: GameScheduleStatus): boolean {
  return status === "cancelled" || status === "postponed" || status === "completed"
}

export function parseGameDateMs(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

/**
 * Soonest game at or after "now" (with a 1-minute grace) that counts as upcoming.
 */
export function getNextUpcomingGame(games: TeamGameRow[], nowMs: number = Date.now()): TeamGameRow | null {
  const sorted = [...games].sort((a, b) => parseGameDateMs(a.gameDate) - parseGameDateMs(b.gameDate))
  const graceMs = 60 * 1000
  for (const g of sorted) {
    const status = inferScheduleStatus(g)
    if (isGameExcludedFromUpcoming(status)) continue
    if (parseGameDateMs(g.gameDate) >= nowMs - graceMs) {
      return g
    }
  }
  return null
}

/** Upcoming games first (soonest first), then past games (most recent first). */
export function sortGamesScheduleView(games: TeamGameRow[], nowMs: number = Date.now()): TeamGameRow[] {
  const dayStart = startOfDay(new Date(nowMs)).getTime()
  const upcoming = games.filter((g) => parseGameDateMs(g.gameDate) >= dayStart)
  const past = games.filter((g) => parseGameDateMs(g.gameDate) < dayStart)
  upcoming.sort((a, b) => parseGameDateMs(a.gameDate) - parseGameDateMs(b.gameDate))
  past.sort((a, b) => parseGameDateMs(b.gameDate) - parseGameDateMs(a.gameDate))
  return [...upcoming, ...past]
}
