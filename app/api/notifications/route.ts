import { NextResponse } from "next/server"
import { applyRefreshedSessionCookies, type SessionUser } from "@/lib/auth/server-auth"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { requireTeamAccessWithUser, MembershipLookupError } from "@/lib/auth/rbac"
import {
  getCachedNotificationsPayload,
  loadNotificationsApiPayload,
} from "@/lib/notifications/notifications-api-query"
import { shouldLogRoutePerf, routePerf, logRoutePerf, type RoutePerfSink } from "@/lib/debug/route-perf"

/**
 * GET /api/notifications
 * `preview=1`: slimmer columns for dashboard card (no metadata / read_at); enables 8s Data Cache for polling.
 * Without preview: full row shape for other consumers.
 */
export async function GET(request: Request) {
  const started = performance.now()
  const sink: RoutePerfSink | null = shouldLogRoutePerf() ? [] : null

  try {
    const sessionResult = await routePerf(sink, "auth", () => getRequestAuth())
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)
    const previewMode = searchParams.get("preview") === "1"

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await routePerf(sink, "membership", () =>
      requireTeamAccessWithUser(teamId, sessionResult.user as SessionUser)
    )

    const userId = sessionResult.user.id
    const useCache = !shouldLogRoutePerf()

    const payload = await routePerf(sink, "notifications_query", () =>
      useCache
        ? getCachedNotificationsPayload(userId, teamId, unreadOnly, limit, offset, previewMode)
        : loadNotificationsApiPayload({ userId, teamId, unreadOnly, limit, offset, previewMode })
    )

    if (sink) {
      sink.push({ label: "total", ms: Math.round(performance.now() - started) })
      logRoutePerf("GET /api/notifications", sink, {
        teamId,
        userId,
        preview: String(previewMode),
        cached: String(useCache),
      })
    }

    const res = NextResponse.json({
      notifications: payload.notifications,
      unreadCount: payload.unreadCount,
      hasMore: payload.hasMore,
    })
    if (sessionResult.refreshedSession) {
      applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    }
    return res
  } catch (error: unknown) {
    if (error instanceof MembershipLookupError) {
      console.error("[GET /api/notifications] membership", error)
      return NextResponse.json({ error: "Failed to verify access" }, { status: 500 })
    }
    console.error("Get notifications error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
