/**
 * GET /api/dashboard/bootstrap?teamId=
 *
 * Single round-trip for the team dashboard: `shell` (nav / app bootstrap shape), `dashboard` (home:
 * team header, games, calendar, readiness summary), full `roster`, `depthChart`, notifications preview,
 * announcements, and coach-only `readinessDetail` (full per-player readiness for roster tab).
 *
 * Caching:
 * - Full payload: `unstable_cache` (LW_TTL_DASHBOARD_BOOTSTRAP), key teamId + userId + coach bucket.
 * - Nested `dashboard` slice may hit its own cache entry.
 * - Tags: dashboard bootstrap, announcements, notifications (user+team).
 *
 * With DEBUG_BOOTSTRAP_TIMING=1 or NODE_ENV=development, payload cache is skipped so sub-step timings log.
 */
import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { resolveTeamAccess } from "@/lib/auth/team-access-resolve"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { logPermissionDenial } from "@/lib/audit/structured-logger"
import {
  buildFullDashboardBootstrapData,
  getCachedFullDashboardBootstrap,
  liteUserToSessionUser,
  requestAppOrigin,
} from "@/lib/dashboard/build-full-dashboard-bootstrap"
import type { FullDashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
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
    const u = session.user
    const sessionUser = liteUserToSessionUser(u)
    const appOrigin = requestAppOrigin(request)
    let payload: FullDashboardBootstrapPayload
    if (usePayloadCache) {
      payload = await timedBootstrap(timingSink, "bootstrap_payload_cached", () =>
        getCachedFullDashboardBootstrap(
          teamId,
          userId,
          u.email,
          u.teamId,
          u.role ?? "",
          u.isPlatformOwner === true,
          access,
          sessionUser,
          appOrigin
        )
      )
    } else {
      payload = await buildFullDashboardBootstrapData(
        teamId,
        userId,
        u.email,
        u.teamId,
        u.role ?? "",
        u.isPlatformOwner === true,
        access,
        sessionUser,
        appOrigin,
        timingSink
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
