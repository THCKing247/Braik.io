import type { SessionUser } from "@/lib/auth/server-auth"
import type { DashboardShellTeam } from "@/lib/dashboard/load-dashboard-shell-teams-uncached"
import type { ImpersonationSession } from "@/lib/admin/impersonation"
import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"

/**
 * Wire shape for GET /api/dashboard/shell — global portal chrome only (teams list, routing, billing flags).
 * Team capability flags + home/roster data live in GET /api/dashboard/bootstrap* payloads (AppBootstrapPayload).
 * See DASHBOARD_DATA_OWNERSHIP.md.
 */
export type DashboardShellPayload =
  | {
      shellMode: "ad-delegate"
      user: SessionUser
      impersonation: ImpersonationSession | null
    }
  | {
      shellMode: "full"
      user: SessionUser
      /** Resolved server-side for portal chrome, routing, and nav hrefs. */
      portalKind: BraikPortalKind
      teams: DashboardShellTeam[]
      currentTeamId: string
      impersonation: ImpersonationSession | null
      subscriptionPaid: boolean
      remainingBalance: number
      currentTeamStatus?: string
      /** Resolved for standalone `/player/:accountId` shell (numeric `player_account_id`). */
      playerAccountSegment?: string | null
      /** Resolved for standalone `/parent/:linkCode` shell (primary linked child key). */
      parentPortalSegment?: string | null
    }
