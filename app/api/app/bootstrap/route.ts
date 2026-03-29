import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { resolveTeamAccess } from "@/lib/auth/team-access-resolve"
import { buildAppBootstrapPayload } from "@/lib/app/build-app-bootstrap"
import { buildAppAdPortalBootstrapPayload } from "@/lib/app/build-app-ad-portal-bootstrap"
import { getCachedAppBootstrap, getCachedAppAdPortalBootstrap } from "@/lib/app/app-bootstrap-cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { shouldLogRoutePerf, routePerf, logRoutePerf, type RoutePerfSink } from "@/lib/debug/route-perf"

export const runtime = "nodejs"

/** Team portal shell — short CDN hint; client React Query also dedupes. */
const APP_BOOTSTRAP_CACHE_CONTROL = "private, max-age=0, s-maxage=30, stale-while-revalidate=60"

/** AD portal shell — matches server `unstable_cache` TTL and user-scoped tag invalidation. */
const AD_PORTAL_BOOTSTRAP_CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=120"

function withAppBootstrapCache(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", APP_BOOTSTRAP_CACHE_CONTROL)
  return res
}

function withAdPortalBootstrapCache(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", AD_PORTAL_BOOTSTRAP_CACHE_CONTROL)
  return res
}

/**
 * GET /api/app/bootstrap?teamId= — team portal shell.
 * GET /api/app/bootstrap?portal=ad — Athletic Director portal shell (no teamId).
 */
export async function GET(request: Request) {
  const started = performance.now()
  const sink: RoutePerfSink | null = shouldLogRoutePerf() ? [] : null

  try {
    const sessionResult = await routePerf(sink, "auth", () => getRequestUserLite())
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const portal = url.searchParams.get("portal")?.trim().toLowerCase()

    if (portal === "ad") {
      const u = sessionResult.user
      const useCache = !shouldLogRoutePerf()
      try {
        const payload = await routePerf(sink, "query", () =>
          useCache
            ? getCachedAppAdPortalBootstrap(u.id, u.email, u.role ?? "", u.isPlatformOwner === true)
            : buildAppAdPortalBootstrapPayload(getSupabaseServer(), {
                userId: u.id,
                email: u.email,
                liteRole: u.role ?? "",
                isPlatformOwner: u.isPlatformOwner === true,
              })
        )
        if (sink) {
          sink.push({ label: "total", ms: Math.round(performance.now() - started) })
          logRoutePerf("GET /api/app/bootstrap?portal=ad", sink, {
            userId: u.id,
            cached: String(useCache),
          })
        }
        const res = withAdPortalBootstrapCache(NextResponse.json(payload))
        if (sessionResult.refreshedSession) {
          applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
        }
        return res
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === "AD_BOOTSTRAP_FORBIDDEN") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        throw err
      }
    }

    const teamId = url.searchParams.get("teamId")?.trim()
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

    const res = withAppBootstrapCache(NextResponse.json(payload))
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
