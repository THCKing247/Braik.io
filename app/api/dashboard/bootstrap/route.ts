/**
 * GET /api/dashboard/bootstrap?teamId=
 *
 * Single round-trip for the team dashboard: `shell` (nav / app bootstrap shape), `dashboard` (home:
 * team header, games, calendar, readiness summary), full `roster`, `depthChart`, notifications preview,
 * announcements, and coach engagement counts for hints. Full per-player readiness loads from roster routes.
 *
 * Caching:
 * - Full payload: `unstable_cache` (LW_TTL_DASHBOARD_BOOTSTRAP), key teamId + userId + coach bucket.
 * - Nested `dashboard` slice may hit its own cache entry.
 * - Tags: dashboard bootstrap, announcements, notifications (user+team).
 *
 * With DEBUG_BOOTSTRAP_TIMING=1 or NODE_ENV=development, payload cache is skipped so sub-step timings log.
 */
import { NextResponse } from "next/server"
import { applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getRequestAuth, getResolvedTeamAccessForRequest } from "@/lib/auth/request-auth-context"
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
import { applyDashboardBootstrapCacheHeaders } from "@/lib/dashboard/dashboard-bootstrap-http"
import { braikPerfServerEnabled } from "@/lib/perf/braik-perf-config"
import { applyServerTiming, perfLogServer } from "@/lib/perf/braik-perf-server"

export async function GET(request: Request) {
  const requestStarted = performance.now()
  const timingSink: BootstrapTimingSink | null =
    shouldLogBootstrapTiming() || braikPerfServerEnabled() ? { steps: [] } : null

  try {
    const teamId = new URL(request.url).searchParams.get("teamId")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const session = await timedBootstrap(timingSink, "auth", () => getRequestAuth())
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    let access: Awaited<ReturnType<typeof getResolvedTeamAccessForRequest>>
    try {
      access = await timedBootstrap(timingSink, "membership", () => getResolvedTeamAccessForRequest(teamId))
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
      if (shouldLogBootstrapTiming()) {
        logBootstrapTimingSummary(timingSink, {
          teamId,
          userId,
          payloadCacheEnabled: usePayloadCache,
        })
      }
      if (braikPerfServerEnabled()) {
        perfLogServer("api.GET.dashboard.bootstrap", {
          teamId,
          userId,
          payloadCache: usePayloadCache,
          steps: timingSink.steps,
        })
      }
    }

    const res = NextResponse.json(payload)
    applyDashboardBootstrapCacheHeaders(res)
    if (session.refreshedSession) {
      applyRefreshedSessionCookies(res, session.refreshedSession)
    }
    if (timingSink && braikPerfServerEnabled()) {
      applyServerTiming(
        res,
        timingSink.steps.map((s) => ({
          name: s.label.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40),
          dur: s.ms,
        }))
      )
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
