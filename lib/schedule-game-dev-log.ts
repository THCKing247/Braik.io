import type { TeamGameRow } from "@/lib/team-schedule-games"
import {
  effectiveTotalsFromGame,
  inferScheduleStatus,
  isResultsTabGame,
  isScheduleTabGame,
  normalizeStoredResult,
} from "@/lib/team-schedule-games"

/** Client-only dev logging for schedule/score saves (no-op in production). */
export function logScheduleGameDev(
  phase: string,
  data: {
    gameBefore?: TeamGameRow | null
    payload?: unknown
    gameAfter?: TeamGameRow | null
  }
): void {
  if (process.env.NODE_ENV === "production") return
  const g0 = data.gameBefore
  const g1 = data.gameAfter
  // eslint-disable-next-line no-console -- intentional dev diagnostics
  console.debug(`[schedule-game] ${phase}`, {
    payload: data.payload,
    before: g0
      ? {
          id: g0.id,
          gameDate: g0.gameDate,
          result: g0.result,
          teamScore: g0.teamScore,
          opponentScore: g0.opponentScore,
          resultsTab: isResultsTabGame(g0),
          scheduleTab: isScheduleTabGame(g0),
        }
      : null,
    after: g1
      ? {
          id: g1.id,
          gameDate: g1.gameDate,
          result: g1.result,
          teamScore: g1.teamScore,
          opponentScore: g1.opponentScore,
          resultsTab: isResultsTabGame(g1),
          scheduleTab: isScheduleTabGame(g1),
        }
      : null,
  })
}

/**
 * Dev-only: per-game classification for Schedule vs Results tabs (why a row is in/out of Results).
 * No-op in production.
 */
export function logScheduleGamesPartitionDebug(games: TeamGameRow[], label = "merged-games"): void {
  if (process.env.NODE_ENV === "production") return
  const gamesOut = games.map((g) => {
    const eff = effectiveTotalsFromGame(g)
    const norm = normalizeStoredResult(g.result)
    const status = inferScheduleStatus(g)
    const inResults = isResultsTabGame(g)
    const inSchedule = isScheduleTabGame(g)
    let whyResults: string
    if (inResults) {
      if (eff.team != null && eff.opponent != null) whyResults = "completed: both effective scores"
      else if (norm) whyResults = `completed: result → ${norm}`
      else whyResults = "completed (unexpected branch)"
    } else {
      whyResults = `schedule/other: inferScheduleStatus=${status}`
    }
    return {
      id: g.id,
      opponent: g.opponent,
      gameDate: g.gameDate,
      result: g.result,
      teamScore: g.teamScore,
      opponentScore: g.opponentScore,
      effectiveTotals: eff,
      normalizedResult: norm,
      inferScheduleStatus: status,
      includedInResults: inResults,
      includedInSchedule: inSchedule,
      isResultsTabGame: inResults,
      isScheduleTabGame: inSchedule,
      whyResults,
    }
  })
  // eslint-disable-next-line no-console -- intentional dev diagnostics
  console.debug(`[schedule-games-partition] ${label}`, { count: games.length, games: gamesOut })
}
