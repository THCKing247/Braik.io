import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { canAccessAdPortalRoutes, resolveFootballAdAccessState } from "@/lib/enforcement/football-ad-access"
import { loadAdCoachesBootstrapUncached, loadAdCoachesBootstrapWithMeta } from "@/lib/ad/ad-bootstrap"
import { getCachedAdCoachesBootstrap } from "@/lib/ad/ad-bootstrap-cache"
import { logAdDashboardMetrics, logAdTeamVisibility } from "@/lib/ad-team-scope"
import { shouldLogRoutePerf, routePerf, logRoutePerf, type RoutePerfSink } from "@/lib/debug/route-perf"

export const runtime = "nodejs"

/**
 * GET /api/ad/bootstrap?teamId=optional — single payload for AD Coaches tab:
 * visible teams (picklist fields), head/assistant rows, engagement hints for context team.
 */
export async function GET(request: Request) {
  const started = performance.now()
  const sink: RoutePerfSink | null = shouldLogRoutePerf() ? [] : null

  try {
    const sessionResult = await routePerf(sink, "auth", () => getRequestUserLite())
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionResult.user.id
    const role = sessionResult.user.role ?? ""
    const hintsTeamParam = new URL(request.url).searchParams.get("teamId")

    const supabase = getSupabaseServer()
    const footballAccess = await routePerf(sink, "access", () =>
      resolveFootballAdAccessState(supabase, userId)
    )
    if (!canAccessAdPortalRoutes(footballAccess)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const useCache = !shouldLogRoutePerf()
    let payload: Awaited<ReturnType<typeof loadAdCoachesBootstrapUncached>>
    if (useCache) {
      payload = await routePerf(sink, "query", () =>
        getCachedAdCoachesBootstrap(userId, role, hintsTeamParam)
      )
    } else {
      const { payload: p, pageData } = await routePerf(sink, "query", () =>
        loadAdCoachesBootstrapWithMeta(supabase, userId, role, hintsTeamParam)
      )
      payload = p
      logAdTeamVisibility("GET /api/ad/bootstrap", {
        scope: pageData.scope,
        sessionRole: role,
        teamCount: pageData.teamsPicklist.length,
        teamIds: pageData.teamsPicklist.map((t) => t.id),
        filter: pageData.orFilter,
        queryError: pageData.teamsQueryError,
      })
      const headCoachMembershipCount = pageData.headRows.filter((r) => r.userId).length
      logAdDashboardMetrics("GET /api/ad/bootstrap", {
        scope: pageData.scope,
        sessionRole: role,
        visibleTeamIds: pageData.teamsPicklist.map((t) => t.id),
        teamCount: pageData.teamsPicklist.length,
        headCoachMembershipCount,
        assistantCoachMembershipCount: pageData.assistantRows.length,
        totalCoachMemberships: headCoachMembershipCount + pageData.assistantRows.length,
        athleteCount: 0,
        emptyStateTriggered: pageData.teamsPicklist.length === 0,
        orFilter: pageData.orFilter,
        teamsQueryError: pageData.teamsQueryError,
        playersCountError: null,
      })
    }

    if (sink) {
      sink.push({ label: "total", ms: Math.round(performance.now() - started) })
      logRoutePerf("GET /api/ad/bootstrap", sink, {
        userId,
        cached: String(useCache),
        teams: String(payload.teams.length),
      })
    }

    const res = NextResponse.json({
      teams: payload.teams,
      coaches: payload.coaches,
      hints: payload.hints,
      hintsContextTeamId: payload.hintsContextTeamId,
    })
    if (sessionResult.refreshedSession) {
      applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    }
    return res
  } catch (e) {
    console.error("[GET /api/ad/bootstrap]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
