import type { SessionUser } from "@/lib/auth/server-auth"
import type { DashboardShellTeam } from "@/lib/dashboard/load-dashboard-shell-teams-uncached"
import type { ImpersonationSession } from "@/lib/admin/impersonation"

export type DashboardShellPayload =
  | {
      shellMode: "ad-delegate"
      user: SessionUser
      impersonation: ImpersonationSession | null
    }
  | {
      shellMode: "full"
      user: SessionUser
      teams: DashboardShellTeam[]
      currentTeamId: string
      impersonation: ImpersonationSession | null
      subscriptionPaid: boolean
      remainingBalance: number
      currentTeamStatus?: string
    }
