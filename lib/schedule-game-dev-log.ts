import type { TeamGameRow } from "@/lib/team-schedule-games"
import { isResultsTabGame, isScheduleTabGame } from "@/lib/team-schedule-games"

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
