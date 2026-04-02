/**
 * PATCH body for editing **final score / result only** on an existing game.
 * Intentionally excludes opponent, gameDate, location, gameType, conferenceGame
 * so result edits cannot wipe or overwrite scheduling columns in the database.
 */
export type ResultPatchFormState = {
  result: string
  teamScore: string
  opponentScore: string
  notes: string
  confirmedByCoach: boolean
  q1_home: string
  q2_home: string
  q3_home: string
  q4_home: string
  q1_away: string
  q2_away: string
  q3_away: string
  q4_away: string
}

function qPayload(s: string): number | null {
  return s.trim() === "" ? null : Number(s)
}

export function buildCompletedGameResultPatchBody(state: ResultPatchFormState): Record<string, unknown> {
  return {
    result: state.result?.trim() ? state.result.trim().toLowerCase() : null,
    teamScore: state.teamScore.trim() === "" ? null : Number(state.teamScore),
    opponentScore: state.opponentScore.trim() === "" ? null : Number(state.opponentScore),
    notes: state.notes.trim() || null,
    confirmedByCoach: state.confirmedByCoach,
    q1_home: qPayload(state.q1_home),
    q2_home: qPayload(state.q2_home),
    q3_home: qPayload(state.q3_home),
    q4_home: qPayload(state.q4_home),
    q1_away: qPayload(state.q1_away),
    q2_away: qPayload(state.q2_away),
    q3_away: qPayload(state.q3_away),
    q4_away: qPayload(state.q4_away),
  }
}
