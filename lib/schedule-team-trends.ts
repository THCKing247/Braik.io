import {
  type TeamGameRow,
  deriveGameOutcome,
  effectiveTotalsFromGame,
  inferHomeAway,
  inferScheduleStatus,
} from "@/lib/team-schedule-games"
import { formatRecordLine } from "@/lib/records/compute-team-record"

export type TeamTrendsSnapshot = {
  completedCount: number
  upcomingCount: number
  record: { wins: number; losses: number; ties: number }
  recordLabel: string
  avgPointsScored: number | null
  avgPointsAllowed: number | null
  avgPointDiff: number | null
  /** e.g. "Won 3 in a row" or "Lost last 2" */
  streakLabel: string
  lastThreeSummary: string
  highestScoringGame: {
    opponent: string
    ourScore: number
    theirScore: number
    gameDate: string
  } | null
  lowestScoringGame: {
    opponent: string
    ourScore: number
    theirScore: number
    gameDate: string
  } | null
  homeRecordLabel: string
  awayRecordLabel: string
}

function parseMs(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

export function computeTeamTrends(games: TeamGameRow[]): TeamTrendsSnapshot {
  const completed = games.filter((g) => inferScheduleStatus(g) === "completed")
  const upcoming = games.filter((g) => inferScheduleStatus(g) === "scheduled")

  let wins = 0
  let losses = 0
  let ties = 0
  let sumUs = 0
  let sumThem = 0
  let nScores = 0

  let homeW = 0
  let homeL = 0
  let homeT = 0
  let awayW = 0
  let awayL = 0
  let awayT = 0

  for (const g of completed) {
    const eff = effectiveTotalsFromGame(g)
    if (eff.team == null || eff.opponent == null) continue
    nScores++
    sumUs += eff.team
    sumThem += eff.opponent
    const o = deriveGameOutcome({ ...g, teamScore: eff.team, opponentScore: eff.opponent })
    const ha = inferHomeAway(g.location)
    if (o === "win") {
      wins++
      if (ha === "away") awayW++
      else homeW++
    } else if (o === "loss") {
      losses++
      if (ha === "away") awayL++
      else homeL++
    } else if (o === "tie") {
      ties++
      if (ha === "away") awayT++
      else homeT++
    }
  }

  const sortedCompleted = [...completed].sort((a, b) => parseMs(a.gameDate) - parseMs(b.gameDate))

  let streakLabel = "—"
  if (sortedCompleted.length > 0) {
    const tail = [...sortedCompleted].sort((a, b) => parseMs(b.gameDate) - parseMs(a.gameDate))
    const first = deriveGameOutcome(tail[0])
    if (first === "win" || first === "loss") {
      const want = first
      let len = 0
      for (const g of tail) {
        const o = deriveGameOutcome(g)
        if (o !== want) break
        len++
      }
      streakLabel = want === "win" ? `W${len}` : `L${len}`
    } else if (first === "tie") {
      let len = 0
      for (const g of tail) {
        if (deriveGameOutcome(g) !== "tie") break
        len++
      }
      streakLabel = `T${len}`
    }
  }

  let highest: TeamTrendsSnapshot["highestScoringGame"] = null
  let lowest: TeamTrendsSnapshot["lowestScoringGame"] = null
  for (const g of sortedCompleted) {
    const eff = effectiveTotalsFromGame(g)
    if (eff.team == null) continue
    const opp = g.opponent?.trim() || "TBD"
    const cand = {
      opponent: opp,
      ourScore: eff.team,
      theirScore: eff.opponent ?? 0,
      gameDate: g.gameDate,
    }
    if (!highest || cand.ourScore > highest.ourScore) highest = cand
    if (!lowest || cand.ourScore < lowest.ourScore) lowest = cand
  }

  const last3 = [...sortedCompleted]
    .sort((a, b) => parseMs(b.gameDate) - parseMs(a.gameDate))
    .slice(0, 3)
  const lastThreeSummary =
    last3.length === 0
      ? "No completed games yet."
      : last3
          .map((g) => {
            const eff = effectiveTotalsFromGame(g)
            const o = deriveGameOutcome(g)
            const lbl = o === "win" ? "W" : o === "loss" ? "L" : o === "tie" ? "T" : "?"
            return `${lbl} vs ${g.opponent?.trim() || "TBD"} (${eff.team ?? "—"}–${eff.opponent ?? "—"})`
          })
          .join(" · ")

  const rec = { wins, losses, ties }

  return {
    completedCount: completed.length,
    upcomingCount: upcoming.length,
    record: rec,
    recordLabel: formatRecordLine(rec),
    avgPointsScored: nScores > 0 ? Math.round((sumUs / nScores) * 10) / 10 : null,
    avgPointsAllowed: nScores > 0 ? Math.round((sumThem / nScores) * 10) / 10 : null,
    avgPointDiff: nScores > 0 ? Math.round(((sumUs - sumThem) / nScores) * 10) / 10 : null,
    streakLabel,
    lastThreeSummary,
    highestScoringGame: highest,
    lowestScoringGame: lowest,
    homeRecordLabel: formatRecordLine({ wins: homeW, losses: homeL, ties: homeT }),
    awayRecordLabel: formatRecordLine({ wins: awayW, losses: awayL, ties: awayT }),
  }
}
