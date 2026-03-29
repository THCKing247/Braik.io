import { cache } from "react"
import {
  loadDashboardShellTeamsUncached,
  type DashboardShellTeam,
} from "@/lib/dashboard/load-dashboard-shell-teams-uncached"

export type { DashboardShellTeam }

/**
 * Minimal team list for the dashboard shell (nav, switcher, portal context).
 * Cached per request for the same user/impersonation tuple so repeated access is free.
 */
export const loadDashboardShellTeams = cache(loadDashboardShellTeamsUncached)
