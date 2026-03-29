import type { AdPortalAccess } from "@/lib/ad-portal-access"
import type { AthleticDirectorScope } from "@/lib/ad-team-scope"
import type { AppBootstrapUser } from "@/lib/app/app-bootstrap-types"
import type { AdPortalTabVisibility, FootballAdAccessState } from "@/lib/enforcement/football-ad-access"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"

export type AdPortalTeamSummary = {
  id: string
  name: string
  programId: string | null
  sport: string | null
  teamLevel: string | null
  gender: string | null
}

/** AD portal shell — mirrors team `AppBootstrapPayload` philosophy: no rosters, coach rows, or messages. */
export type AppAdPortalBootstrapPayload = {
  portal: "ad"
  user: AppBootstrapUser
  organization: {
    athleticDepartmentId: string | null
    departmentStatus: string | null
    organizationIds: string[]
    primaryOrganizationName: string | null
  }
  school: { id: string | null; name: string | null }
  /** Varsity football program when viewer is restricted HC-style AD access. */
  program: { id: string; name: string | null; sport: string | null } | null
  teamsSummary: AdPortalTeamSummary[]
  /** Same scope used for AD team queries (logging / debugging). */
  scope: AthleticDirectorScope
  orFilter: string | null
  teamsQueryError: string | null
  /** Team list governance (e.g. program_ids vs department) — same input as `fetchAdVisibleTeamsForAccess`. */
  adPortalAccess: AdPortalAccess
  flags: {
    tabVisibility: AdPortalTabVisibility
    canPerformDepartmentOwnerActions: boolean
    accessState: FootballAdAccessState
    programId: string | null
    primaryTeamId: string | null
  }
  /**
   * Present when `GET /api/app/bootstrap?portal=ad&includeTeamsTable=1` — same rows as
   * GET /api/ad/pages/teams-table (avoids a second HTTP round trip on the Teams page).
   */
  teamsTable?: TeamRow[]
  /** Set when embedded teams-table load fails (rare); shell fields still valid. */
  teamsTableError?: string | null
  generatedAt: string
}
