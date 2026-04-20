import { NextResponse } from "next/server"
import { applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import {
  getAdPortalAccessForUser,
  adPortalShowsOverviewAndSettings,
} from "@/lib/ad-portal-access"
import { getCachedAdPortalAccessForUser } from "@/lib/ad-portal-access-cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { shouldLogRoutePerf, routePerf, logRoutePerf, type RoutePerfSink } from "@/lib/debug/route-perf"
import {
  buildOrganizationPortalPath,
  resolveDefaultShortOrgIdForUser,
  resolveDefaultOrganizationPortalUuidForUser,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

/** Client helper: varsity HC / AD portal entry and nav scope (no separate “director” shell). */
export async function GET() {
  const started = performance.now()
  const sink: RoutePerfSink | null = shouldLogRoutePerf() ? [] : null

  try {
    const sessionResult = await routePerf(sink, "auth", () => getRequestAuth())
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionResult.user.id
    const roleUpper = sessionResult.user.role
    const useCache = !shouldLogRoutePerf()

    const access = await routePerf(sink, "query", () =>
      useCache
        ? getCachedAdPortalAccessForUser(userId, roleUpper)
        : getAdPortalAccessForUser(getSupabaseServer(), userId, roleUpper)
    )

    const canEnter = access.mode !== "none"
    const restricted = access.mode === "restricted_football"
    const showOverviewAndSettings = adPortalShowsOverviewAndSettings(access)
    const supabase = getSupabaseServer()
    const [organizationPortalUuid, shortOrgId] = await routePerf(sink, "org_portal", () =>
      Promise.all([
        resolveDefaultOrganizationPortalUuidForUser(supabase, userId),
        resolveDefaultShortOrgIdForUser(supabase, userId),
      ])
    )
    const defaultOrgPath = shortOrgId
      ? buildOrganizationPortalPath(shortOrgId, restricted ? "/teams" : "")
      : restricted
        ? "/dashboard/ad/teams"
        : "/dashboard/ad"

    if (sink) {
      sink.push({ label: "total", ms: Math.round(performance.now() - started) })
      logRoutePerf("GET /api/me/ad-portal", sink, {
        userId,
        cached: String(useCache),
        mode: access.mode,
      })
    }

    const res = NextResponse.json({
      canEnterAdPortal: canEnter,
      mode: access.mode,
      restrictedFootball: restricted,
      showOverviewAndSettings,
      shortOrgId,
      organizationPortalUuid,
      /** First stop in athletic department shell after login (varsity HC with football scope). */
      defaultPath: defaultOrgPath,
    })
    if (sessionResult.refreshedSession) {
      applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    }
    return res
  } catch (e) {
    console.error("[GET /api/me/ad-portal]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
