/**
 * Shared types for Coach B Braik-aware AI. Domain, intent, entities, and normalized context shapes.
 */

// ─── Domain ─────────────────────────────────────────────────────────────────

export type QuestionDomain =
  | "players"
  | "playbooks"
  | "injuries"
  | "schedule"
  | "roster"
  | "reports"
  | "generic"
  | "multi_domain"

// ─── Intent ─────────────────────────────────────────────────────────────────

export type QuestionIntent =
  | "player_decision"
  | "player_comparison"
  | "player_evaluation"
  | "player_availability"
  | "player_stats"
  | "play_lookup"
  | "play_recommendation"
  | "formation_lookup"
  | "injury_summary"
  | "schedule_summary"
  | "roster_summary"
  | "report_summary"
  | "game_planning"
  | "practice_planning"
  | "multi_domain"
  | "generic"

// ─── Detected entities ──────────────────────────────────────────────────────

export interface DetectedEntities {
  namedPlayers: string[]
  positions: string[]
  formationNames: string[]
  playNames: string[]
  concepts: string[]
  dateTimeRefs: string[]
  opponents: string[]
}

// ─── Normalized context types ───────────────────────────────────────────────

export interface PlayerContext {
  id: string
  fullName: string
  jerseyNumber: number | null
  primaryPosition: string | null
  secondaryPositions: string | null
  classYear: number | null
  height: string | null
  weight: number | null
  starter: boolean
  depthChartOrder: string | null
  availability: string
  injuryStatus: string | null
  profileSummary: string | null
  coachNotes: string | null
  stats: {
    passing: Record<string, unknown> | null
    rushing: Record<string, unknown> | null
    receiving: Record<string, unknown> | null
    defense: Record<string, unknown> | null
    kicking: Record<string, unknown> | null
    specialTeams: Record<string, unknown> | null
  }
}

export interface PlaybookContext {
  playbooks: Array<{ id: string; name: string; formationCount?: number; playCount?: number }>
  formations: Array<{ id: string; name: string; side: string; playbookId: string | null; subFormationCount?: number; playCount?: number }>
  plays: PlayContext[]
}

export interface PlayContext {
  id: string
  name: string
  formation: string
  subformation: string | null
  tags: string[] | null
  concept: string | null
  playType: string | null
  notes: string | null
  situation: string | null
  motion: string | null
  assignmentsSummary: string | null
}

export interface InjuryContext {
  playerId: string
  fullName: string
  status: string
  availability: string
  practiceStatus: string | null
  bodyPart: string | null
  notes: string | null
  expectedReturn: string | null
  reason: string
}

export interface ScheduleContext {
  id: string
  title: string
  type: "event" | "game" | "practice"
  start: string
  end: string | null
  opponent: string | null
  location: string | null
  notes: string | null
}

export interface RosterContext {
  totalPlayers: number
  countsByPosition: Record<string, number>
  startersByPosition: Record<string, string[]>
  depthChartSummary: string[]
}

export interface ReportContext {
  id?: string
  source: string
  excerpt: string
  type?: string
}

// ─── Top-level Braik context ────────────────────────────────────────────────

export interface TeamInfo {
  id: string
  name: string | null
}

export interface BraikContext {
  team: TeamInfo | null
  domain: QuestionDomain
  intent: QuestionIntent
  relatedDomains: QuestionDomain[]
  entities: DetectedEntities
  players: PlayerContext[]
  playbooks: Array<{ id: string; name: string; formationCount?: number; playCount?: number }>
  formations: Array<{ id: string; name: string; side: string; playbookId: string | null; subFormationCount?: number; playCount?: number }>
  plays: PlayContext[]
  injuries: InjuryContext[]
  schedule: ScheduleContext[]
  rosterSummary: RosterContext | null
  reports: ReportContext[]
  limitations: string[]
}

// ─── Inputs for context modules ─────────────────────────────────────────────

export interface ContextModuleInput {
  teamId: string
  message: string
  entities: DetectedEntities
  supabase: ReturnType<typeof import("@/src/lib/supabaseServer").getSupabaseServer>
}
