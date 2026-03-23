import { deriveGameOutcome, inferScheduleStatus, type TeamGameRow } from "@/lib/team-schedule-games"

/**
 * Overall + district (conference) W-L(-T) from scheduled games with final results.
 * Outcomes prefer final scores, then stored `result` (`inferScheduleStatus` + `deriveGameOutcome`).
 */
export function computeTeamRecord(games: TeamGameRow[]) {
  let overallWins = 0
  let overallLosses = 0
  let overallTies = 0

  let districtWins = 0
  let districtLosses = 0
  let districtTies = 0

  for (const game of games) {
    if (inferScheduleStatus(game) !== "completed") continue

    const outcome = deriveGameOutcome(game)
    if (!outcome) continue

    const isDistrict = Boolean(game.conferenceGame)

    if (outcome === "win") {
      overallWins++
      if (isDistrict) districtWins++
    } else if (outcome === "loss") {
      overallLosses++
      if (isDistrict) districtLosses++
    } else {
      overallTies++
      if (isDistrict) districtTies++
    }
  }

  return {
    overall: { wins: overallWins, losses: overallLosses, ties: overallTies },
    district: { wins: districtWins, losses: districtLosses, ties: districtTies },
  }
}

export function formatRecordLine(r: { wins: number; losses: number; ties: number }) {
  if (r.ties > 0) return `${r.wins}-${r.losses}-${r.ties}`
  return `${r.wins}-${r.losses}`
}
