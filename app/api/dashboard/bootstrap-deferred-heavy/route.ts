/**
 * GET /api/dashboard/bootstrap-deferred-heavy?teamId=
 *
 * Third phase: depth chart entries only (after deferred-core).
 */
import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { resolveTeamAccess } from "@/lib/auth/team-access-resolve"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { logPermissionDenial } from "@/lib/audit/structured-logger"
import {
  buildDashboardBootstrapDeferredHeavyData,
  getCachedDashboardBootstrapDeferredHeavy,
} from "@/lib/dashboard/build-dashboard-deferred-bootstrap"
import type { DashboardBootstrapDeferredHeavyPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
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
        console.error("[GET /api/dashboard/bootstrap-deferred-heavy] membership lookup", err)
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

    let payload: DashboardBootstrapDeferredHeavyPayload
    if (usePayloadCache) {
      payload = await timedBootstrap(timingSink, "bootstrap_deferred_heavy_cached", () =>
        getCachedDashboardBootstrapDeferredHeavy(teamId)
      )
    } else {
      payload = await timedBootstrap(timingSink, "bootstrap_deferred_heavy", () =>
        buildDashboardBootstrapDeferredHeavyData(teamId)
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
    console.error("[GET /api/dashboard/bootstrap-deferred-heavy]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
