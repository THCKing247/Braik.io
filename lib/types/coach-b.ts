/**
 * Coach B play suggestion contract. Structured output for play ideas.
 * Real AI integration can be plugged in behind this interface.
 */

export interface PlaySuggestionRoute {
  /** Player role (e.g. WR1, RB, TE) */
  role: string
  /** Route concept (e.g. Go, Slant, Flat) */
  route: string
}

export interface PlaySuggestion {
  /** Suggested play name */
  playName: string
  /** Concept type (e.g. Pass, RPO, Screen) */
  conceptType: string
  /** Routes by player role */
  routesByRole: PlaySuggestionRoute[]
  /** Short rationale from Coach B */
  rationale: string
}

export interface CoachBSuggestPlayRequest {
  prompt: string
  /** Optional: playbook/formation context for scoping */
  playbookId?: string
  formationId?: string
}

export interface CoachBSuggestPlayResponse {
  suggestions: PlaySuggestion[]
}
