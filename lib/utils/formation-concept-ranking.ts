/**
 * Formation Intelligence Phase 3: rank suggested concepts using playbook/team data.
 * Deterministic, explainable ranking—no AI. Prioritizes concepts already used in the playbook.
 */

import type { RecommendedConcept } from "@/lib/constants/formation-concept-recommendations"

export interface PlayForRanking {
  name: string
  tags?: string[] | null
}

export interface RankedConcept {
  concept: RecommendedConcept
  /** Explainable hint for UI (e.g. "Common in your playbook", "Popular for Trips") */
  hint?: string
  /** Number of plays that contributed to this concept's score (for tie-breaking / display) */
  playCount?: number
}

const EXACT_WEIGHT = 3
const PARTIAL_WEIGHT = 1
const TAG_WEIGHT = 2

/** Normalize for comparison: lowercase, trim, collapse whitespace */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

/** Score one concept against a list of plays. Higher = more common in playbook. */
function scoreConcept(concept: RecommendedConcept, plays: PlayForRanking[]): { score: number; playCount: number } {
  if (plays.length === 0) return { score: 0, playCount: 0 }

  const conceptNorm = normalize(concept.name)
  const categoryNorm = concept.category ? normalize(concept.category) : ""

  let score = 0
  let contributingPlays = 0

  for (const play of plays) {
    const playNameNorm = normalize(play.name)
    let playScore = 0

    // Exact name match
    if (playNameNorm === conceptNorm) {
      playScore += EXACT_WEIGHT
    }
    // Partial: play name contains concept name (e.g. "Mesh - Right" matches "Mesh")
    else if (conceptNorm.length >= 2 && playNameNorm.includes(conceptNorm)) {
      playScore += PARTIAL_WEIGHT
    }
    // Partial: concept name contains play name (e.g. concept "Four Verticals" vs play "Verticals")
    else if (playNameNorm.length >= 2 && conceptNorm.includes(playNameNorm)) {
      playScore += PARTIAL_WEIGHT
    }

    // Tag match: play tags include concept category (e.g. tags ["Pass"] and category "Pass")
    if (categoryNorm && Array.isArray(play.tags)) {
      const tagMatch = play.tags.some((t) => normalize(t) === categoryNorm)
      if (tagMatch) playScore += TAG_WEIGHT
    }

    if (playScore > 0) {
      score += playScore
      contributingPlays += 1
    }
  }

  return { score, playCount: contributingPlays }
}

/**
 * Rank suggested concepts: concepts that appear in the given plays (by name/tags)
 * are ordered first with a "Common in your playbook" hint; the rest follow with
 * "Popular for {familyLabel}".
 */
export function rankConcepts(
  concepts: RecommendedConcept[],
  plays: PlayForRanking[],
  familyLabel: string
): RankedConcept[] {
  const withScores = concepts.map((concept) => {
    const { score, playCount } = scoreConcept(concept, plays)
    const hint = score > 0 ? "Common in your playbook" : `Popular for ${familyLabel}`

    return {
      concept,
      score,
      playCount: score > 0 ? playCount : undefined,
      hint,
    }
  })

  // Sort: by score desc, then by original order (stable)
  withScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aIdx = concepts.indexOf(a.concept)
    const bIdx = concepts.indexOf(b.concept)
    return aIdx - bIdx
  })

  return withScores.map(({ concept, hint, playCount }) => ({
    concept,
    hint,
    playCount,
  }))
}
