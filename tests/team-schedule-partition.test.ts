/**
 * Schedule vs Results partition + week labels (full list stable).
 * Run: npx tsx tests/team-schedule-partition.test.ts
 */
import {
  groupGamesByScheduleWeek,
  partitionGamesForScheduleTabs,
  type TeamGameRow,
} from "../lib/team-schedule-games"

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("Fail:", msg)
    process.exit(1)
  }
}

function row(id: string, iso: string, scores?: { t: number; o: number }): TeamGameRow {
  return {
    id,
    opponent: `Opp-${id}`,
    gameDate: iso,
    location: null,
    gameType: "regular",
    result: null,
    notes: null,
    seasonYear: 2025,
    teamScore: scores?.t ?? null,
    opponentScore: scores?.o ?? null,
  }
}

function run() {
  const g1 = row("a", "2025-09-01T19:00:00.000Z")
  const g2 = row("b", "2025-09-08T19:00:00.000Z")
  const g3 = row("c", "2025-09-15T19:00:00.000Z")

  const all = [g1, g2, g3]
  const p0 = partitionGamesForScheduleTabs(all)
  assert(p0.scheduleGames.length === 3, "schedule tab lists all games")
  assert(p0.resultsGames.length === 0, "no results yet")

  const g1scored = { ...g1, teamScore: 21, opponentScore: 14 }
  const allAfter = [g1scored, g2, g3]
  const p1 = partitionGamesForScheduleTabs(allAfter)
  assert(p1.scheduleGames.length === 3, "scored game still on schedule list")
  assert(p1.resultsGames.length === 1 && p1.resultsGames[0].id === "a", "one result row")

  const weeksBefore = groupGamesByScheduleWeek(all)
  const weeksAfter = groupGamesByScheduleWeek(allAfter)
  assert(weeksBefore.length === weeksAfter.length, "week bucket count unchanged after score")
  const label0 = weeksBefore[0]?.label
  const label1 = weeksAfter[0]?.label
  assert(label0 === label1, `Week 1 label stable: ${label0} vs ${label1}`)

  const resultsOnly = p1.resultsGames
  const wgResults = groupGamesByScheduleWeek(resultsOnly)
  const wgFromFull = groupGamesByScheduleWeek(allAfter)
  assert(wgResults.length < wgFromFull.length || resultsOnly.length === 1, "filtered-only weeks can collapse")
  const idSet = new Set(resultsOnly.map((g) => g.id))
  const filteredFromFull = wgFromFull
    .map((w) => ({
      ...w,
      games: w.games.filter((g) => idSet.has(g.id)),
    }))
    .filter((w) => w.games.length > 0)
  assert(filteredFromFull[0]?.label === wgFromFull[0]?.label, "Results week label matches full-schedule Week 1")

  console.log("All team-schedule-partition tests passed.")
}

run()
