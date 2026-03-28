/**
 * GET /api/dashboard/bootstrap-deferred-core?teamId=
 *
 * Second phase: full home dashboard slice (games, calendar, readiness summary) + roster + notification rows +
 * announcements + coach readiness detail. Depth chart is bootstrap-deferred-heavy.
 */
import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { resolveTeamAccess } from "@/lib/auth/team-access-resolve"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { logPermissionDenial } from "@/lib/audit/structured-logger"
import {
  buildDashboardBootstrapDeferredCoreData,
  getCachedDashboardBootstrapDeferredCore,
} from "@/lib/dashboard/build-dashboard-deferred-bootstrap"
import { liteUserToSessionUser, requestAppOrigin } from "@/lib/dashboard/build-full-dashboard-bootstrap"
import type { DashboardBootstrapDeferredCorePayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import { applyDashboardBootstrapCacheHeaders } from "@/lib/dashboard/dashboard-bootstrap-http"
import {
  shouldLogBootstrapTiming,
  timedBootstrap,
  logBootstrapTimingSummary,
  type BootstrapTimingSink,
} from "@/lib/debug/bootstrap-timing"

export async function GET(request: Request) {
  const requestStarted = performance.now()
  const timingSink: BootstrapTimingSink | null = shouldLogBootstrapTiming() ? { steps: [] } : null

  try {
    const teamId = new URL(request.url).searchParams.get("teamId")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const session = await timedBootstrap(timingSink, "auth", () => getRequestUserLite())
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    let access: Awaited<ReturnType<typeof resolveTeamAccess>>
    try {
      access = await timedBootstrap(timingSink, "membership", () => resolveTeamAccess(teamId, userId))
    } catch (err) {
      if (err instanceof MembershipLookupError) {
        console.error("[GET /api/dashboard/bootstrap-deferred-core] membership lookup", err)
        return NextResponse.json({ error: "Access check failed" }, { status: 500 })
      }
      throw err
    }

    if (!access) {
      logPermissionDenial({
        userId,
        teamId,
        reason: "Not a member of this team",
      })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const usePayloadCache = !shouldLogBootstrapTiming()
    const u = session.user
    const sessionUser = liteUserToSessionUser(u)
    const appOrigin = requestAppOrigin(request)

    let payload: DashboardBootstrapDeferredCorePayload
    if (usePayloadCache) {
      payload = await timedBootstrap(timingSink, "bootstrap_deferred_core_cached", () =>
        getCachedDashboardBootstrapDeferredCore(teamId, userId, access, sessionUser, appOrigin)
      )
    } else {
      payload = await timedBootstrap(timingSink, "bootstrap_deferred_core", () =>
        buildDashboardBootstrapDeferredCoreData(teamId, userId, access, sessionUser, appOrigin)
      )
    }

    if (timingSink) {
      timingSink.steps.push({
        label: "total_request",
        ms: Math.round(performance.now() - requestStarted),
      })
      logBootstrapTimingSummary(timingSink, {
        teamId,
        userId,
        payloadCacheEnabled: usePayloadCache,
      })
    }

    const res = NextResponse.json(payload)
    applyDashboardBootstrapCacheHeaders(res)
    if (session.refreshedSession) {
      applyRefreshedSessionCookies(res, session.refreshedSession)
    }
    return res
  } catch (err) {
    if (err instanceof Error && err.message === "TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }
    if (err instanceof Error && err.message.startsWith("GAMES_QUERY_FAILED")) {
      console.error("[GET /api/dashboard/bootstrap-deferred-core] games", err.message)
      return NextResponse.json({ error: "Failed to load games" }, { status: 500 })
    }
    if (err instanceof Error && err.message.startsWith("CALENDAR_QUERY_FAILED")) {
      console.error("[GET /api/dashboard/bootstrap-deferred-core] calendar", err.message)
      return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 })
    }
    console.error("[GET /api/dashboard/bootstrap-deferred-core]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
