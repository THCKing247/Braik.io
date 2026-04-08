import type { PlayerJoinMatchCandidate } from "./claim-types"

export type MatchConfidence = "high" | "medium" | "none"

export interface PlayerMatchInput {
  firstName: string
  lastName: string
  jerseyNumber?: number | null
  graduationYear?: number | null
  /** ISO date yyyy-mm-dd */
  dateOfBirth?: string | null
}

export interface RosterPlayerForMatch {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  graduation_year: number | null
  date_of_birth: string | null
  position_group: string | null
  user_id?: string | null
}

export function normalizePersonName(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function namesExact(a: string, b: string): boolean {
  return normalizePersonName(a) === normalizePersonName(b)
}

export function scorePlayerMatch(existing: RosterPlayerForMatch, input: PlayerMatchInput): MatchConfidence {
  const fn = namesExact(existing.first_name, input.firstName)
  const ln = namesExact(existing.last_name, input.lastName)
  if (!fn || !ln) return "none"

  const jerseyMatch =
    input.jerseyNumber != null &&
    existing.jersey_number != null &&
    Number(input.jerseyNumber) === Number(existing.jersey_number)

  const gradMatch =
    input.graduationYear != null &&
    existing.graduation_year != null &&
    Number(input.graduationYear) === Number(existing.graduation_year)

  const dobIn = (input.dateOfBirth ?? "").trim()
  const exDob = (existing.date_of_birth ?? "").trim()
  const dobMatch = Boolean(dobIn && exDob && dobIn === exDob.slice(0, 10))

  if (jerseyMatch || gradMatch || dobMatch) return "high"
  return "medium"
}

export type ScoredCandidate = {
  player: RosterPlayerForMatch
  confidence: MatchConfidence
}

export function scoreTeamRosterForMatch(
  roster: RosterPlayerForMatch[],
  input: PlayerMatchInput
): ScoredCandidate[] {
  const out: ScoredCandidate[] = []
  for (const player of roster) {
    const confidence = scorePlayerMatch(player, input)
    if (confidence !== "none") {
      out.push({ player, confidence })
    }
  }
  return out
}

const toCandidate = (player: RosterPlayerForMatch, matchLevel: "high" | "medium"): PlayerJoinMatchCandidate => ({
  id: player.id,
  firstName: player.first_name,
  lastName: player.last_name,
  jerseyNumber: player.jersey_number,
  positionGroup: player.position_group,
  graduationYear: player.graduation_year,
  matchLevel,
})

/**
 * Conservative rules: auto-claim only with exactly one high-confidence row and no other candidate.
 */
export function resolveMatchDecision(scored: ScoredCandidate[]): {
  outcome: "no_match" | "auto_claim" | "needs_confirmation"
  autoPlayerId?: string
  candidates?: PlayerJoinMatchCandidate[]
} {
  const highs = scored.filter((s) => s.confidence === "high")
  const mediums = scored.filter((s) => s.confidence === "medium")

  if (highs.length === 0 && mediums.length === 0) {
    return { outcome: "no_match" }
  }

  if (highs.length === 1 && mediums.length === 0) {
    return { outcome: "auto_claim", autoPlayerId: highs[0].player.id }
  }

  const candidates: PlayerJoinMatchCandidate[] = [
    ...highs.map((s) => toCandidate(s.player, "high")),
    ...mediums.map((s) => toCandidate(s.player, "medium")),
  ]
  return { outcome: "needs_confirmation", candidates }
}
