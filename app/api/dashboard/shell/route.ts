import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  getRequestUserLite,
  applyRefreshedSessionCookies,
  type SessionUser,
} from "@/lib/auth/server-auth"
import { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"
import { authTimingServer } from "@/lib/auth/login-flow-timing"
import { loadDashboardShellTeamsUncached } from "@/lib/dashboard/load-dashboard-shell-teams-uncached"
import { BRAIK_DASHBOARD_TEAM_HINT_COOKIE } from "@/lib/navigation/dashboard-team-hint-cookie"
import {
  getActiveImpersonationFromToken,
  getSupportTokenFromRequestCookieHeader,
} from "@/lib/admin/impersonation"
import type { DashboardShellPayload } from "@/lib/dashboard/dashboard-shell-payload"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type { DashboardShellPayload as DashboardShellResponse }

/**
 * Dashboard shell after client mount. Resolves session via cookie JWT + `getUser` (never `auth.getSession()`).
 */
export async function GET(request: Request) {
  const t0 = performance.now()
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 })
  }

  try {
    authTimingServer("dashboard_shell_request_start")
    const supportToken = getSupportTokenFromRequestCookieHeader(request.headers.get("cookie"))
    const [liteResult, impersonationSession] = await Promise.all([
      getRequestUserLite(),
      getActiveImpersonationFromToken(supportToken),
    ])

    if (!liteResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    const jsonResponse = (body: DashboardShellPayload) => {
      const res = NextResponse.json(body)
      if (liteResult.refreshedSession) {
        applyRefreshedSessionCookies(res, liteResult.refreshedSession)
      }
      return res
    }

    authTimingServer("dashboard_shell_auth_done", { ms: Math.round(performance.now() - t0) })

    if (userRole === "ATHLETIC_DIRECTOR") {
      authTimingServer("dashboard_shell_response_ad_delegate", { ms: Math.round(performance.now() - t0) })
      return jsonResponse({
        shellMode: "ad-delegate",
        user: shellUser,
        impersonation: impersonationSession,
      })
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
    return jsonResponse({
      shellMode: "full",
      user: shellUser,
      teams,
      currentTeamId,
      impersonation: impersonationSession,
      subscriptionPaid,
      remainingBalance,
      currentTeamStatus: currentTeam?.teamStatus,
    })
  } catch (err) {
    console.error("[GET /api/dashboard/shell]", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "Shell temporarily unavailable" }, { status: 503 })
  }
}
