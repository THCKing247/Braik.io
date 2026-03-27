import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies, type SessionUser } from "@/lib/auth/server-auth"
import { requireTeamAccessWithUser, MembershipLookupError } from "@/lib/auth/rbac"
import {
  buildEngagementHints,
  getCachedEngagementHintCounts,
  loadEngagementHintCounts,
  type EngagementHint,
} from "@/lib/engagement/dashboard-hints-data"
import { shouldLogRoutePerf, routePerf, logRoutePerf, type RoutePerfSink } from "@/lib/debug/route-perf"

export type { EngagementHint }

const COACH_ROLES = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])

/**
 * GET /api/engagement/hints?teamId= — lightweight, privacy-safe setup nudges for coaches.
 * Uses lite auth + parallel counts + short-lived cached counts (team-scoped).
 */
export async function GET(request: Request) {
  const started = performance.now()
  const sink: RoutePerfSink | null = shouldLogRoutePerf() ? [] : null

  try {
    const sessionResult = await routePerf(sink, "auth", () => getRequestUserLite())
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = sessionResult.user.role ?? ""
    if (!COACH_ROLES.has(role)) {
      const empty = NextResponse.json({ hints: [] as EngagementHint[] })
      if (sessionResult.refreshedSession) applyRefreshedSessionCookies(empty, sessionResult.refreshedSession)
      return empty
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await routePerf(sink, "membership", () =>
      requireTeamAccessWithUser(teamId, sessionResult.user as SessionUser)
    )

    const useCountCache = !shouldLogRoutePerf()
    const counts = await routePerf(sink, "hint_counts", () =>
      useCountCache ? getCachedEngagementHintCounts(teamId) : loadEngagementHintCounts(teamId)
    )

    const hints = buildEngagementHints(teamId, counts)

    if (sink) {
      sink.push({ label: "total", ms: Math.round(performance.now() - started) })
      logRoutePerf("GET /api/engagement/hints", sink, {
        teamId,
        userId: sessionResult.user.id,
        countsCached: String(useCountCache),
      })
    }

    const res = NextResponse.json({ hints })
    if (sessionResult.refreshedSession) {
      applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    }
    return res
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify access" }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : "Error"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("[GET /api/engagement/hints]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
