/**
 * GET /api/stats/games?teamId=&seasonYear=
 * Scheduled games for the team (for weekly stat entry + filters).
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { mapDbGameRowToTeamGameRow } from "@/lib/team-game-row-map"

export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")?.trim()
    const seasonYearParam = searchParams.get("seasonYear")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const { data: rows, error } = await supabase
      .from("games")
      .select(
        "id, opponent, game_date, location, game_type, result, notes, conference_game, team_score, opponent_score, confirmed_by_coach, season_id, seasons(year), q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away"
      )
      .eq("team_id", teamId)
      .order("game_date", { ascending: true })

    if (error) {
      console.error("[GET /api/stats/games]", error)
      return NextResponse.json({ error: "Failed to load games" }, { status: 500 })
    }

    let games = (rows ?? []).map((r: Record<string, unknown>) => mapDbGameRowToTeamGameRow(r))

    if (seasonYearParam) {
      const y = parseInt(seasonYearParam, 10)
      if (Number.isFinite(y)) {
        games = games.filter((g) => g.seasonYear === y)
      }
    }

    return NextResponse.json({ games })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[GET /api/stats/games]", err)
    return NextResponse.json({ error: "Failed to load games" }, { status: 500 })
  }
}
