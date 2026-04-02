/**
 * Shared rules for entering final game scores (team + opponent) in the portal.
 * Keeps copy and validation aligned across inline edit, bulk, and dialogs.
 */

export const FINAL_SCORE_PAIR_MESSAGE = "Enter both team and opponent scores to save a final result."

/** True if the user started entering a score on either side (non-empty after trim). */
export function hasAnyFinalScoreInput(teamRaw: string, opponentRaw: string): boolean {
  return teamRaw.trim() !== "" || opponentRaw.trim() !== ""
}

/** True only when both sides have a value (0 is valid). */
export function hasCompleteFinalScorePair(teamRaw: string, opponentRaw: string): boolean {
  return teamRaw.trim() !== "" && opponentRaw.trim() !== ""
}
