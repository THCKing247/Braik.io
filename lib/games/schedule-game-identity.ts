/**
 * Stable identity for schedule games: used for CSV idempotency and DB uniqueness
 * (team + normalized opponent + canonical kickoff instant).
 */

/** Normalize opponent for case-insensitive, whitespace-tolerant matching. */
export function normalizeOpponentForSchedule(opponent: string): string {
  return opponent.trim().replace(/\s+/g, " ").toLowerCase()
}

/** Canonical ISO string for the same instant (avoids string-format mismatches). */
export function canonicalGameDateIso(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  return new Date(ms).toISOString()
}

export function scheduleGameIdentityKey(teamId: string, opponent: string, gameDateIso: string): string {
  return `${teamId}\u0000${normalizeOpponentForSchedule(opponent)}\u0000${canonicalGameDateIso(gameDateIso)}`
}

export function gameRowMatchesParsed(
  db: { opponent: string | null; game_date: string },
  parsed: { opponent: string; gameDateIso: string }
): boolean {
  return (
    normalizeOpponentForSchedule(db.opponent ?? "") === normalizeOpponentForSchedule(parsed.opponent) &&
    canonicalGameDateIso(db.game_date) === canonicalGameDateIso(parsed.gameDateIso)
  )
}
