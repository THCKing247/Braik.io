import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { resolveTeamAccess } from "@/lib/auth/team-access-resolve"
import { buildAppBootstrapPayload } from "@/lib/app/build-app-bootstrap"
import { getCachedAppBootstrap } from "@/lib/app/app-bootstrap-cache"
import { shouldLogRoutePerf, routePerf, logRoutePerf, type RoutePerfSink } from "@/lib/debug/route-perf"

export const runtime = "nodejs"

/**
 * GET /api/app/bootstrap?teamId=
 * Lightweight portal shell: user + team header fields, unread count, engagement counts, capability flags.
 */
export async function GET(request: Request) {
  const started = performance.now()
  const sink: RoutePerfSink | null = shouldLogRoutePerf() ? [] : null

  try {
    const sessionResult = await routePerf(sink, "auth", () => getRequestUserLite())
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const teamId = new URL(request.url).searchParams.get("teamId")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const u = sessionResult.user
    const access = await routePerf(sink, "membership", () => resolveTeamAccess(teamId, u.id))
    if (!access) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const useCache = !shouldLogRoutePerf()
    const payload = await routePerf(sink, "query", () =>
      useCache
        ? getCachedAppBootstrap(
            u.id,
            u.email,
            teamId,
            u.teamId,
            u.role,
            u.isPlatformOwner === true,
            access.membership
          )
        : buildAppBootstrapPayload({
            userId: u.id,
            email: u.email,
            teamId,
            liteTeamId: u.teamId,
            liteRole: u.role,
            isPlatformOwner: u.isPlatformOwner === true,
            membership: access.membership,
          })
    )

    if (sink) {
      sink.push({ label: "total", ms: Math.round(performance.now() - started) })
      logRoutePerf("GET /api/app/bootstrap", sink, {
        userId: u.id,
        teamId,
        cached: String(useCache),
      })
    }

    const res = NextResponse.json(payload)
    if (sessionResult.refreshedSession) {
      applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    }
    return res
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }
    console.error("[GET /api/app/bootstrap]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
