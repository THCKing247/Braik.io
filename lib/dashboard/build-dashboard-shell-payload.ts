import { cookies } from "next/headers"
import {
  getRequestUserLite,
  type RefreshedSession,
  type SessionUser,
} from "@/lib/auth/server-auth"
import { isSupabaseServerConfigured } from "@/src/lib/supabase-project-env"
import { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"
import { authTimingServer } from "@/lib/auth/login-flow-timing"
import { loadDashboardShellTeamsUncached } from "@/lib/dashboard/load-dashboard-shell-teams-uncached"
import { BRAIK_DASHBOARD_TEAM_HINT_COOKIE } from "@/lib/navigation/dashboard-team-hint-cookie"
import {
  getActiveImpersonationFromToken,
  getSupportTokenFromRequestCookieHeader,
} from "@/lib/admin/impersonation"
import type { DashboardShellPayload } from "@/lib/dashboard/dashboard-shell-payload"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i

export type DashboardShellPayloadResult = {
  payload: DashboardShellPayload
  refreshedSession?: RefreshedSession
}

export class DashboardShellUnauthorized extends Error {
  override name = "DashboardShellUnauthorized"
}

export class DashboardShellServerNotConfigured extends Error {
  override name = "DashboardShellServerNotConfigured"
}

function cookieHeaderFromRequestCookies(): string {
  try {
    return cookies()
      .getAll()
      .map((c) => `${encodeURIComponent(c.name)}=${encodeURIComponent(c.value)}`)
      .join("; ")
  } catch {
    return ""
  }
}

/**
 * Shared dashboard shell loader for both the API route and RSC dashboard layouts.
 * Keep this payload shape aligned with GET /api/dashboard/shell.
 */
export async function buildDashboardShellPayload(options: { cookieHeader?: string | null } = {}): Promise<DashboardShellPayloadResult> {
  const t0 = performance.now()
  if (!isSupabaseServerConfigured()) {
    throw new DashboardShellServerNotConfigured("Server auth is not configured")
  }

  authTimingServer("dashboard_shell_request_start")
  const cookieHeader = options.cookieHeader ?? cookieHeaderFromRequestCookies()
  const supportToken = getSupportTokenFromRequestCookieHeader(cookieHeader)
  const [liteResult, impersonationSession] = await Promise.all([
    getRequestUserLite(),
    getActiveImpersonationFromToken(supportToken),
  ])

  if (!liteResult?.user?.id) {
    throw new DashboardShellUnauthorized("Unauthorized")
  }

  const u = liteResult.user
  const shellUser: SessionUser = {
    id: u.id,
    email: u.email,
    name: null,
    role: u.role,
    adminRole: undefined,
    teamId: u.teamId,
    teamName: undefined,
    organizationName: undefined,
    positionGroups: null,
    isPlatformOwner: u.isPlatformOwner === true,
    defaultAppPath: getDefaultAppPathForRole(u.role),
  }

  const userRole = shellUser.role?.toUpperCase()
  authTimingServer("dashboard_shell_auth_done", { ms: Math.round(performance.now() - t0) })

  if (userRole === "ATHLETIC_DIRECTOR") {
    authTimingServer("dashboard_shell_response_ad_delegate", { ms: Math.round(performance.now() - t0) })
    return {
      payload: {
        shellMode: "ad-delegate",
        user: shellUser,
        impersonation: impersonationSession,
      },
      refreshedSession: liteResult.refreshedSession,
    }
  }

  const effectiveUserId = impersonationSession?.target_user_id ?? shellUser.id
  const isImpersonating = Boolean(impersonationSession)

  const teams = await loadDashboardShellTeamsUncached(
    effectiveUserId,
    shellUser.id,
    shellUser.teamId,
    isImpersonating
  )
  authTimingServer("dashboard_shell_teams_done", { ms: Math.round(performance.now() - t0), teamCount: teams.length })

  const cookieStore = cookies()
  const dashboardTeamHint = cookieStore.get(BRAIK_DASHBOARD_TEAM_HINT_COOKIE)?.value ?? null

  const validTeamIds = new Set(teams.map((t) => t.id))
  const sessionTeamId = shellUser.teamId
  const hintOk =
    userRole === "ATHLETIC_DIRECTOR" &&
    dashboardTeamHint &&
    UUID_RE.test(dashboardTeamHint) &&
    validTeamIds.has(dashboardTeamHint)
  const currentTeamId = impersonationSession
    ? teams[0]?.id ?? ""
    : hintOk
      ? dashboardTeamHint!
      : sessionTeamId && validTeamIds.has(sessionTeamId)
        ? sessionTeamId
        : teams[0]?.id ?? ""

  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]

  const remainingBalance = 0
  const subscriptionPaid = true

  authTimingServer("dashboard_shell_response_full", { ms: Math.round(performance.now() - t0) })
  return {
    payload: {
      shellMode: "full",
      user: shellUser,
      teams,
      currentTeamId,
      impersonation: impersonationSession,
      subscriptionPaid,
      remainingBalance,
      currentTeamStatus: currentTeam?.teamStatus,
    },
    refreshedSession: liteResult.refreshedSession,
  }
}
