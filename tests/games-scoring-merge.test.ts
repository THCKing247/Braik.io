/**
 * Regression tests for game score PATCH merge (null-safe, no accidental wipes).
 * Run: npx tsx tests/games-scoring-merge.test.ts
 */
import { mergeGameScoringPatch, type GamesDbRow } from "../lib/games-api-scoring"

const baseExisting = (): GamesDbRow => ({
  location: "Home",
  team_score: 14,
  opponent_score: 21,
  q1_home: null,
  q2_home: null,
  q3_home: null,
  q4_home: null,
  q1_away: null,
  q2_away: null,
  q3_away: null,
  q4_away: null,
})

function assertEq<T>(got: T, exp: T, label: string) {
  const ok = JSON.stringify(got) === JSON.stringify(exp)
  if (!ok) {
    console.error("Fail:", label, "expected", exp, "got", got)
    process.exit(1)
  }
}

function run() {
  const ex = baseExisting()

  // JSON null does not wipe the other column
  const partialNull = mergeGameScoringPatch({ teamScore: 28, opponentScore: null }, ex)
  assertEq(partialNull.team_score, 28, "team_score updates")
  assertEq(partialNull.opponent_score, undefined, "opponent omitted when JSON null (preserve in SQL merge via undefined)")
  const ts =
    partialNull.team_score !== undefined ? (partialNull.team_score as number | null) : ex.team_score
  const os =
    partialNull.opponent_score !== undefined ? (partialNull.opponent_score as number | null) : ex.opponent_score
  assertEq(ts, 28, "resolved team")
  assertEq(os, 21, "resolved opponent preserved")

  // Omitted keys: no change
  const empty = mergeGameScoringPatch({}, ex)
  assertEq(Object.keys(empty).length, 0, "empty body returns empty patch")

  // Both scores saves + clears quarters when replacing totals
  const both = mergeGameScoringPatch({ teamScore: 10, opponentScore: 12 }, ex)
  assertEq(both.team_score, 10, "both team")
  assertEq(both.opponent_score, 12, "both opp")
  assertEq(both.q1_home, null, "quarter cleared")

  // clearFinalScores
  const cleared = mergeGameScoringPatch({ clearFinalScores: true }, ex)
  assertEq(cleared.team_score, null, "clear team")
  assertEq(cleared.opponent_score, null, "clear opp")
  assertEq(cleared.result, null, "clear result")

  // Result-only W/L without score keys — no scoring patch
  const wlOnly = mergeGameScoringPatch({ result: "win" } as Record<string, unknown>, ex)
  assertEq(Object.keys(wlOnly).length, 0, "result-only does not touch merge (handled in route)")

  console.log("All games merge tests passed.")
}

run()
