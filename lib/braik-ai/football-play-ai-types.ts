/**
 * Football-specific AI assistance types (play suggestions, playbook learning).
 * Keep UI honest: these structures support future features; not all are persisted yet.
 */

import type { AiGeneratedPlayDescriptor, AiSuggestedRoute } from "@/lib/playbook/ai-generated-play-schema"

export type FootballPlaySuggestionPayload = {
  summary: string
  suggestedPlay: AiGeneratedPlayDescriptor
  /** IDs of playbook plays referenced as analogues, when available. */
  similarPlayIds?: string[]
}

/**
 * Future: signals for "playbook mastery" — aggregated from installs, quizzes, practice reps.
 * TODO: Persist per program/team when mastery product specs land.
 */
export type PlaybookMasterySignal = {
  playId: string
  /** 0–1 confidence from data coverage */
  masteryScore?: number
  lastReppedAt?: string
  notes?: string
}

export function suggestedRoutesToDescriptor(
  playName: string,
  routes: AiSuggestedRoute[],
  opts?: { playType?: string | null; tags?: string[]; coachingNotes?: string }
): AiGeneratedPlayDescriptor {
  return {
    name: playName,
    side: "offense",
    playType: opts?.playType ?? null,
    tags: opts?.tags,
    routes,
    coachingNotes: opts?.coachingNotes,
  }
}
