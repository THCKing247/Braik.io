/**
 * GET /api/stats/games?teamId=&seasonYear=&startDate=&endDate=
 * Scheduled games for the team (schedule page, weekly stats, dashboard).
 *
 * Optional startDate/endDate (ISO) bound `game_date` for smaller responses + index-friendly scans.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccessWithUser, MembershipLookupError } from "@/lib/auth/rbac"
import { getCachedStatsGamesPayload } from "@/lib/stats/cached-stats-games"
import type { TeamGameRow } from "@/lib/team-schedule-games"

/** Per-member payload (RBAC) — avoid shared caches serving stale lists after score edits. */
const GAMES_CACHE_CONTROL = "private, max-age=0, must-revalidate"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")?.trim()
    const seasonYearParam = searchParams.get("seasonYear")?.trim()
    const startDate = searchParams.get("startDate")?.trim() || null
    const endDate = searchParams.get("endDate")?.trim() || null
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await requireTeamAccessWithUser(teamId, session.user)

    let games: TeamGameRow[]
    try {
      const payload = await getCachedStatsGamesPayload(teamId, {
        startDate,
        endDate,
      })
      games = payload.games
    } catch (e) {
      console.error("[GET /api/stats/games]", e)
      return NextResponse.json({ error: "Failed to load games" }, { status: 500 })
    }

    if (seasonYearParam) {
      const y = parseInt(seasonYearParam, 10)
      if (Number.isFinite(y)) {
        games = games.filter((g) => g.seasonYear === y)
      }
    }

    return NextResponse.json(
      { games },
      {
        headers: {
          "Cache-Control": GAMES_CACHE_CONTROL,
        },
      }
    )
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (msg.includes("Access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[GET /api/stats/games]", err)
    return NextResponse.json({ error: "Failed to load games" }, { status: 500 })
  }
}
