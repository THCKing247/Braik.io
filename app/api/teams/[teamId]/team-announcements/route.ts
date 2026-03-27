import { NextResponse } from "next/server"
import {
  getRequestUserLite,
  getServerSession,
  applyRefreshedSessionCookies,
  type SessionUser,
} from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireAuth, requireTeamAccessWithUser, requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { type TeamAnnouncementAudience } from "@/lib/team-announcements"
import { revalidateTeamAnnouncements, revalidateTeamEngagementHints } from "@/lib/cache/lightweight-get-cache"
import {
  getCachedVisibleTeamAnnouncements,
  loadVisibleTeamAnnouncementsSorted,
} from "@/lib/team-announcements/visible-announcements-query"
import { shouldLogRoutePerf, routePerf, logRoutePerf, type RoutePerfSink } from "@/lib/debug/route-perf"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

const AUDIENCES: TeamAnnouncementAudience[] = ["all", "staff", "players", "parents"]

function parseAudience(v: unknown): TeamAnnouncementAudience {
  const s = typeof v === "string" ? v : "all"
  return AUDIENCES.includes(s as TeamAnnouncementAudience) ? (s as TeamAnnouncementAudience) : "all"
}

/**
 * GET /api/teams/[teamId]/team-announcements
 * Lite auth + slim select (no send_notification). Short-lived cache keyed by team + viewer role.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const started = performance.now()
  const sink: RoutePerfSink | null = shouldLogRoutePerf() ? [] : null

  try {
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const sessionResult = await routePerf(sink, "auth", () => getRequestUserLite())
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { membership } = await routePerf(sink, "membership", () =>
      requireTeamAccessWithUser(teamId, sessionResult.user as SessionUser)
    )

    const useCache = !shouldLogRoutePerf()
    const announcements = await routePerf(sink, "announcements_query", () =>
      useCache
        ? getCachedVisibleTeamAnnouncements(teamId, membership.role)
        : loadVisibleTeamAnnouncementsSorted(teamId, membership.role)
    )

    if (sink) {
      sink.push({ label: "total", ms: Math.round(performance.now() - started) })
      logRoutePerf("GET /api/teams/.../team-announcements", sink, {
        teamId,
        userId: sessionResult.user.id,
        cached: String(useCache),
      })
    }

    const res = NextResponse.json({ announcements })
    if (sessionResult.refreshedSession) {
      applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    }
    return res
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[GET team-announcements] membership", err)
      return NextResponse.json({ error: "Failed to verify access" }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[GET team-announcements]", err)
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/team-announcements
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const user = await requireAuth()
    await requireTeamPermission(teamId, "post_announcements")
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const messageBody = typeof body.body === "string" ? body.body.trim() : ""
    if (!title || !messageBody) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 })
    }

    const audience = parseAudience(body.audience)
    const is_pinned = Boolean(body.is_pinned)
    const send_notification = Boolean(body.send_notification)

    const supabase = getSupabaseServer()
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    const author_name =
      (prof as { full_name?: string; email?: string } | null)?.full_name?.trim() ||
      (prof as { email?: string } | null)?.email?.trim() ||
      null

    const { data: inserted, error } = await supabase
      .from("team_announcements")
      .insert({
        team_id: teamId,
        title: title.slice(0, 500),
        body: messageBody.slice(0, 20000),
        author_id: user.id,
        author_name,
        audience,
        is_pinned,
        send_notification,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[POST team-announcements]", error)
      return NextResponse.json({ error: "Failed to post announcement" }, { status: 500 })
    }

    trackProductEventServer({
      eventName: BRAIK_EVENTS.announcements.posted,
      userId: user.id,
      teamId,
      role: user.role ?? null,
      metadata: {
        announcement_id: inserted?.id ?? null,
        audience,
        pinned: is_pinned,
        send_notification,
      },
    })

    revalidateTeamAnnouncements(teamId)
    revalidateTeamEngagementHints(teamId)

    return NextResponse.json(inserted)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[POST team-announcements]", err)
    return NextResponse.json({ error: "Failed to post announcement" }, { status: 500 })
  }
}
