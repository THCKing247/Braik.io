/**
 * PATCH body for editing **final score / result only** on an existing game.
 * Intentionally excludes opponent, gameDate, location, gameType, conferenceGame
 * so result edits cannot wipe or overwrite scheduling columns in the database.
 */
import { GAME_QUARTER_KEYS } from "@/lib/games-api-scoring"

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

/**
 * Builds JSON for PATCH. Does **not** include `teamScore` / `opponentScore` keys unless both sides
 * have values — so the server merge will not receive JSON `null` that previously wiped one column.
 * Result-only updates (W/L/T) omit score keys entirely.
 */
export function buildCompletedGameResultPatchBody(state: ResultPatchFormState): Record<string, unknown> {
  const out: Record<string, unknown> = {
    result: state.result?.trim() ? state.result.trim().toLowerCase() : null,
    notes: state.notes.trim() || null,
    confirmedByCoach: state.confirmedByCoach,
  }
  for (const k of GAME_QUARTER_KEYS) {
    out[k] = qPayload(state[k as keyof ResultPatchFormState] as string)
  }
  const ts = state.teamScore.trim()
  const os = state.opponentScore.trim()
  if (ts !== "" && os !== "") {
    out.teamScore = Number(ts)
    out.opponentScore = Number(os)
  }
  return out
}
