/**
 * Coach B play suggestion contract. Structured output for play ideas.
 * Real AI integration can be plugged in behind this interface.
 */

export interface PlaySuggestionRoute {
  /** Player role (e.g. WR1, RB, TE) */
  role: string
  /** Route concept (e.g. Go, Slant, Flat) */
  route: string
  /** Optional stem / breakpoint depth in yards (coaching convention). */
  yards?: number
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
  /** Optional: concept name for route-template engine (e.g. Stick, Mesh, Smash) */
  concept?: string
  /** Optional tags for the play (e.g. Red Zone, 3rd Down) */
  tags?: string[]
}

export interface CoachBSuggestPlayRequest {
  /** Team scope for RBAC and logging */
  teamId: string
  prompt: string
  /** Optional: playbook/formation context for scoping */
  playbookId?: string
  formationId?: string
  subFormationId?: string
}

export interface CoachBSuggestPlayResponse {
  suggestions: PlaySuggestion[]
}
