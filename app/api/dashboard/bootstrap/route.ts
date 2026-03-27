/**
 * GET /api/dashboard/bootstrap?teamId=
 *
 * First-paint payload: team header, games, calendar event rows (minimal fields), coach readiness summary.
 * Hints (`/api/engagement/hints`), roster preview (`/api/roster?lite=1`), notifications, and team
 * announcements stay out of bootstrap: they are secondary for first paint, poll or load in parallel,
 * and would widen the cached key surface or duplicate work with those dedicated routes (which now
 * use short-lived caching and slimmer queries).
 *
 * Caching:
 * - Payload: `unstable_cache` 12s, key includes teamId + userId + coach/noncoach (readiness differs).
 * - Membership: cached in `resolveTeamAccess` (~22s) via `getUserMembershipForUserIdCached`.
 * - Readiness summary: existing 30s cache inside `buildDashboardBootstrapData`.
 *
 * With DEBUG_BOOTSTRAP_TIMING=1 or NODE_ENV=development, payload cache is skipped so sub-step timings log.
 */
import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { resolveTeamAccess } from "@/lib/auth/team-access-resolve"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { logPermissionDenial } from "@/lib/audit/structured-logger"
import {
  buildDashboardBootstrapData,
  getCachedDashboardBootstrapData,
} from "@/lib/dashboard/build-dashboard-bootstrap-data"
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
        console.error("[GET /api/dashboard/bootstrap] membership lookup", err)
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
    let payload: Awaited<ReturnType<typeof buildDashboardBootstrapData>>
    if (usePayloadCache) {
      payload = await timedBootstrap(timingSink, "bootstrap_payload_cached", () =>
        getCachedDashboardBootstrapData(teamId, userId, access.canEditRoster)
      )
    } else {
      payload = await buildDashboardBootstrapData(teamId, access.canEditRoster, timingSink)
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
    if (session.refreshedSession) {
      applyRefreshedSessionCookies(res, session.refreshedSession)
    }
    return res
  } catch (err) {
    if (err instanceof Error && err.message === "TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }
    if (err instanceof Error && err.message.startsWith("GAMES_QUERY_FAILED")) {
      console.error("[GET /api/dashboard/bootstrap] games", err.message)
      return NextResponse.json({ error: "Failed to load games" }, { status: 500 })
    }
    if (err instanceof Error && err.message.startsWith("CALENDAR_QUERY_FAILED")) {
      console.error("[GET /api/dashboard/bootstrap] calendar", err.message)
      return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 })
    }
    console.error("[GET /api/dashboard/bootstrap]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
