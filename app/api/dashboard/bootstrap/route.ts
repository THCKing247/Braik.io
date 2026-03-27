/**
 * GET /api/dashboard/bootstrap?teamId=
 *
 * Single payload for the portal team dashboard first paint: team header, schedule games,
 * notifications preview, announcements preview, and coach readiness summary.
 *
 * Uses `getRequestUserLite` (one auth validation + minimal profile read) and
 * `resolveTeamAccess` once, then runs independent queries in parallel.
 */
import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { resolveTeamAccess } from "@/lib/auth/team-access-resolve"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { logPermissionDenial } from "@/lib/audit/structured-logger"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { mapDbGameRowToTeamGameRow } from "@/lib/team-game-row-map"
import { computeTeamReadinessPayload } from "@/lib/server/compute-team-readiness"
import { sortTeamAnnouncements, userCanViewTeamAnnouncement } from "@/lib/team-announcements"
import { getUnreadNotificationCount } from "@/lib/utils/notifications"
import type { DashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"

const READINESS_CACHE_KEY = "braik-team-readiness-summary-v4"

export async function GET(request: Request) {
  try {
    const teamId = new URL(request.url).searchParams.get("teamId")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const session = await getRequestUserLite()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let access: Awaited<ReturnType<typeof resolveTeamAccess>>
    try {
      access = await resolveTeamAccess(teamId, session.user.id)
    } catch (err) {
      if (err instanceof MembershipLookupError) {
        console.error("[GET /api/dashboard/bootstrap] membership lookup", err)
        return NextResponse.json({ error: "Access check failed" }, { status: 500 })
      }
      throw err
    }

    if (!access) {
      logPermissionDenial({
        userId: session.user.id,
        teamId,
        reason: "Not a member of this team",
      })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const userId = session.user.id
    const { membership } = access

    const readinessPromise = access.canEditRoster
      ? unstable_cache(
          async () => computeTeamReadinessPayload(teamId, true),
          [READINESS_CACHE_KEY, teamId],
          { revalidate: 30 }
        )()
      : Promise.resolve(null)

    const [teamRow, gamesResult, notificationsBundle, announcementsRows, readinessPayload] = await Promise.all([
      supabase
        .from("teams")
        .select("id, name, slogan, sport, season_name, logo_url, program_id, team_level")
        .eq("id", teamId)
        .maybeSingle(),
      supabase
        .from("games")
        .select(
          "id, opponent, game_date, location, game_type, result, notes, conference_game, team_score, opponent_score, confirmed_by_coach, season_id, seasons(year), q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away"
        )
        .eq("team_id", teamId)
        .order("game_date", { ascending: true }),
      (async () => {
        const limit = 15
        const [rowsResult, unreadCount] = await Promise.all([
          supabase
            .from("notifications")
            .select(
              "id, user_id, team_id, type, title, body, link_url, link_type, link_id, metadata, read, read_at, created_at"
            )
            .eq("user_id", userId)
            .eq("team_id", teamId)
            .eq("read", false)
            .order("created_at", { ascending: false })
            .range(0, limit - 1),
          getUnreadNotificationCount(userId, teamId),
        ])
        return { rowsResult, unreadCount }
      })(),
      supabase
        .from("team_announcements")
        .select(
          "id, team_id, title, body, author_id, author_name, created_at, updated_at, is_pinned, audience, send_notification"
        )
        .eq("team_id", teamId)
        .order("created_at", { ascending: false }),
      readinessPromise,
    ])

    if (teamRow.error || !teamRow.data) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const t = teamRow.data as Record<string, unknown>
    const gamesData = gamesResult.data
    if (gamesResult.error) {
      console.error("[GET /api/dashboard/bootstrap] games", gamesResult.error)
      return NextResponse.json({ error: "Failed to load games" }, { status: 500 })
    }

    const games = (gamesData ?? []).map((r: Record<string, unknown>) => mapDbGameRowToTeamGameRow(r))

    const { rowsResult: notifQuery, unreadCount } = notificationsBundle
    if (notifQuery.error) {
      console.error("[GET /api/dashboard/bootstrap] notifications", notifQuery.error)
      return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
    }

    const notifications = (notifQuery.data ?? []).map((n: Record<string, unknown>) => ({
      id: n.id as string,
      userId: n.user_id as string,
      teamId: n.team_id as string,
      type: n.type as string,
      title: n.title as string,
      body: (n.body as string | null) ?? null,
      linkUrl: (n.link_url as string | null) ?? null,
      linkType: (n.link_type as string | null) ?? null,
      linkId: (n.link_id as string | null) ?? null,
      metadata: n.metadata,
      read: Boolean(n.read),
      readAt: (n.read_at as string | null) ?? null,
      createdAt: n.created_at as string,
    }))

    if (announcementsRows.error) {
      console.error("[GET /api/dashboard/bootstrap] announcements", announcementsRows.error)
      return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 })
    }

    const rawAnnouncements = announcementsRows.data ?? []
    const visibleAnnouncements = (rawAnnouncements as TeamAnnouncementRow[]).filter((r) =>
      userCanViewTeamAnnouncement(membership.role, String(r.audience || "all"))
    )
    const announcements = sortTeamAnnouncements(visibleAnnouncements)

    let readiness: DashboardBootstrapPayload["readiness"]
    if (access.canEditRoster && readinessPayload?.summary) {
      const s = readinessPayload.summary
      readiness = {
        summary: {
          total: s.total,
          incompleteCount: s.incompleteCount,
          readyCount: s.readyCount,
        },
      }
    } else {
      readiness = { skipped: true }
    }

    const payload: DashboardBootstrapPayload = {
      team: {
        id: t.id as string,
        name: (t.name as string) ?? "",
        slogan: (t.slogan as string | null) ?? null,
        sport: (t.sport as string) ?? "football",
        seasonName: (t.season_name as string) ?? "",
        logoUrl: (t.logo_url as string | null) ?? null,
        programId: (t.program_id as string | null) ?? null,
        teamLevel: (t.team_level as string | null) ?? null,
      },
      games,
      notifications,
      notificationsUnreadCount: unreadCount,
      announcements,
      readiness,
    }

    const res = NextResponse.json(payload)
    if (session.refreshedSession) {
      applyRefreshedSessionCookies(res, session.refreshedSession)
    }
    return res
  } catch (err) {
    console.error("[GET /api/dashboard/bootstrap]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
