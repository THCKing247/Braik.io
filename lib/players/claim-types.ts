export type PlayerClaimStatus = "unclaimed" | "claimed" | "pending_review"

export type PlayerCreatedSource = "coach" | "import" | "player" | "admin"

export type PlayerJoinAnalyzeOutcome =
  | "no_match"
  | "auto_claim"
  | "needs_confirmation"
  | "invalid_code"

export type PlayerJoinIntent = "auto" | "confirm" | "new"

export interface PlayerJoinMatchCandidate {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  graduationYear: number | null
  /** high = name + secondary signal; medium = name only */
  matchLevel: "high" | "medium"
}

export interface PlayerJoinAnalyzeResponse {
  outcome: PlayerJoinAnalyzeOutcome
  teamId?: string
  teamName?: string | null
  candidates?: PlayerJoinMatchCandidate[]
  /** Server hint for signup-secure */
  recommendedIntent?: PlayerJoinIntent
  confirmedPlayerId?: string | null
}
