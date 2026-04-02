/**
 * Shared helpers for team game rows (public.games) — schedule list + dashboard "next game".
 */

import { startOfDay, startOfWeek } from "date-fns"
import {
  type GameQuarters,
  teamOpponentTotalsFromQuarters,
} from "@/lib/games-quarter-scoring"

function normalizeStoredResult(result?: string | null): "win" | "loss" | "tie" | null {
  const r = (result || "").toLowerCase().trim()
  if (r === "win" || r === "w") return "win"
  if (r === "loss" || r === "l") return "loss"
  if (r === "tie" || r === "t") return "tie"
  return null
}

export type TeamGameRow = {
  id: string
  opponent: string
  gameDate: string
  location: string | null
  gameType: string | null
  result: string | null
  notes: string | null
  seasonYear: number | null
  conferenceGame?: boolean
  teamScore?: number | null
  opponentScore?: number | null
  confirmedByCoach?: boolean
  /** Venue-based quarter scoring (optional). See `games` migration. */
  q1_home?: number | null
  q2_home?: number | null
  q3_home?: number | null
  q4_home?: number | null
  q1_away?: number | null
  q2_away?: number | null
  q3_away?: number | null
  q4_away?: number | null
}

/** Map home/away + optional venue line into `games.location` (no DB column for home/away). */
export function buildLocationFromHomeAway(
  homeAway: "home" | "away" | "tbd",
  locationDetail: string,
  opponent: string
): string | null {
  const detail = locationDetail.trim()
  const opp = opponent.trim()
  if (homeAway === "home") {
    if (detail) return detail
    return "Home"
  }
  if (homeAway === "away") {
    if (detail) return detail.startsWith("@") ? detail : `@ ${detail}`
    return opp ? `@ ${opp}` : "@ TBD"
  }
  return detail || null
}

/** Strip synthetic prefixes for editing the "venue" field. */
export function locationDetailForEdit(location: string | null, ha: "home" | "away" | "tbd"): string {
  const loc = (location || "").trim()
  if (!loc) return ""
  if (ha === "away" && loc.startsWith("@")) return loc.replace(/^@\s*/, "").trim()
  if (ha === "home" && /^home$/i.test(loc)) return ""
  return loc
}

export type GameScheduleStatus = "scheduled" | "completed" | "postponed" | "cancelled"

const CANCELLED_RE = /\b(cancelled|canceled)\b/i
const POSTPONED_RE = /\bpostponed\b/i

export function getQuartersFromGame(game: TeamGameRow): GameQuarters {
  return {
    q1_home: game.q1_home ?? null,
    q2_home: game.q2_home ?? null,
    q3_home: game.q3_home ?? null,
    q4_home: game.q4_home ?? null,
    q1_away: game.q1_away ?? null,
    q2_away: game.q2_away ?? null,
    q3_away: game.q3_away ?? null,
    q4_away: game.q4_away ?? null,
  }
}

/** If quarter lines exist, totals should match their sum (team mapped by home/away). */
export function effectiveTotalsFromGame(game: TeamGameRow): { team: number | null; opponent: number | null } {
  const q = getQuartersFromGame(game)
  const { teamScore, opponentScore } = teamOpponentTotalsFromQuarters(game.location, q)
  const hasQ =
    [q.q1_home, q.q2_home, q.q3_home, q.q4_home, q.q1_away, q.q2_away, q.q3_away, q.q4_away].some(
      (n) => n != null && Number.isFinite(Number(n))
    )
  if (hasQ) return { team: teamScore, opponent: opponentScore }
  return {
    team: game.teamScore != null ? Math.trunc(Number(game.teamScore)) : null,
    opponent: game.opponentScore != null ? Math.trunc(Number(game.opponentScore)) : null,
  }
}

export function inferScheduleStatus(game: TeamGameRow): GameScheduleStatus {
  const notes = game.notes?.trim() ?? ""
  if (CANCELLED_RE.test(notes)) return "cancelled"
  if (POSTPONED_RE.test(notes)) return "postponed"
  const eff = effectiveTotalsFromGame(game)
  if (eff.team != null && eff.opponent != null) return "completed"
  const r = (game.result || "").toLowerCase()
  if (r === "win" || r === "loss" || r === "tie") return "completed"
  return "scheduled"
}

/** Win/loss/tie from effective scores first, then stored `result`. */
export function deriveGameOutcome(game: TeamGameRow): "win" | "loss" | "tie" | null {
  const eff = effectiveTotalsFromGame(game)
  if (eff.team != null && eff.opponent != null) {
    const t = eff.team
    const o = eff.opponent
    if (t > o) return "win"
    if (t < o) return "loss"
    return "tie"
  }
  return normalizeStoredResult(game.result)
}

export type WinLossRecord = { wins: number; losses: number; ties: number }

/** Record for our team immediately before this game (same season bucket). */
export function buildCumulativeRecordBeforeMap(games: TeamGameRow[]): Map<string, WinLossRecord> {
  const sorted = [...games].sort((a, b) => {
    const y = (a.seasonYear ?? -1) - (b.seasonYear ?? -1)
    if (y !== 0) return y
    return parseGameDateMs(a.gameDate) - parseGameDateMs(b.gameDate)
  })
  const out = new Map<string, WinLossRecord>()
  const runningBySeason = new Map<string | number, WinLossRecord>()

  for (const g of sorted) {
    const sk = g.seasonYear ?? "unknown"
    const running = runningBySeason.get(sk) ?? { wins: 0, losses: 0, ties: 0 }
    out.set(g.id, { ...running })

    const st = inferScheduleStatus(g)
    if (st === "cancelled" || st === "postponed") continue
    const o = deriveGameOutcome(g)
    if (!o) continue
    if (o === "win") running.wins++
    else if (o === "loss") running.losses++
    else running.ties++
    runningBySeason.set(sk, running)
  }
  return out
}

export type WeekGroup = { weekIndex: number; label: string; games: TeamGameRow[] }

/** Chronological week buckets (Week 1 = earliest week with a game) per season year. */
export function groupGamesByScheduleWeek(games: TeamGameRow[]): WeekGroup[] {
  const seasonKeys = Array.from(new Set(games.map((g) => g.seasonYear ?? "unknown"))).sort((a, b) => {
    if (a === "unknown") return 1
    if (b === "unknown") return -1
    return (a as number) - (b as number)
  })

  const groups: WeekGroup[] = []
  for (const sk of seasonKeys) {
    const seasonGames = games
      .filter((g) => (g.seasonYear ?? "unknown") === sk)
      .sort((a, b) => parseGameDateMs(a.gameDate) - parseGameDateMs(b.gameDate))

    const weekStartToIndex = new Map<number, number>()
    let nextWeek = 1
    const withWeek: { game: TeamGameRow; weekIndex: number }[] = []

    for (const g of seasonGames) {
      const wk = startOfWeek(new Date(g.gameDate), { weekStartsOn: 1 }).getTime()
      let idx = weekStartToIndex.get(wk)
      if (idx === undefined) {
        idx = nextWeek++
        weekStartToIndex.set(wk, idx)
      }
      withWeek.push({ game: g, weekIndex: idx })
    }

    const maxW = withWeek.reduce((m, x) => Math.max(m, x.weekIndex), 0)
    for (let w = 1; w <= maxW; w++) {
      const list = withWeek.filter((x) => x.weekIndex === w).map((x) => x.game)
      if (list.length === 0) continue
      const yearLabel = sk === "unknown" ? "" : ` · ${sk}`
      groups.push({
        weekIndex: w,
        label: `Week ${w}${yearLabel}`,
        games: list,
      })
    }
  }
  return groups
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

/** No usable game date (TBD / placeholder) — stays on the Game Schedule tab. */
export function isUnscheduledGameDate(game: TeamGameRow): boolean {
  const ms = parseGameDateMs(game.gameDate)
  return !Number.isFinite(ms) || ms === 0
}

/**
 * Games that belong on the Game Results tab: finalized scores/outcome, or any past dated game
 * (including those still needing a recorded result).
 */
export function isGameInResultsTab(game: TeamGameRow, nowMs: number = Date.now()): boolean {
  if (inferScheduleStatus(game) === "completed") return true
  if (isUnscheduledGameDate(game)) return false
  const ms = parseGameDateMs(game.gameDate)
  const dayStart = startOfDay(new Date(nowMs)).getTime()
  return ms < dayStart
}

export function partitionGamesForScheduleTabs(
  games: TeamGameRow[],
  nowMs: number = Date.now()
): { scheduleGames: TeamGameRow[]; resultsGames: TeamGameRow[] } {
  const schedule: TeamGameRow[] = []
  const results: TeamGameRow[] = []
  for (const g of games) {
    if (isGameInResultsTab(g, nowMs)) results.push(g)
    else schedule.push(g)
  }
  schedule.sort((a, b) => parseGameDateMs(a.gameDate) - parseGameDateMs(b.gameDate))
  results.sort((a, b) => parseGameDateMs(b.gameDate) - parseGameDateMs(a.gameDate))
  return { scheduleGames: schedule, resultsGames: results }
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
