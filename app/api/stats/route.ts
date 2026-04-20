import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser, MembershipLookupError } from "@/lib/auth/rbac"
import { getPositionSide, toPlayerStatsRow } from "@/lib/stats-helpers"

type PlayerRow = {
  id: string
  player_account_id: string | null
  first_name: string
  last_name: string
  jersey_number: number | null
  position_group: string | null
  season_stats: unknown
}

/**
 * GET /api/stats?teamId=xxx
 * All Stats table reads players.season_stats — a derived cache whose SEASON_STAT_KEYS are
 * maintained by recalculateSeasonStatsFromWeeklyForPlayers from player_weekly_stat_entries.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    await requireTeamAccessWithUser(teamId, session.user)

    const { data: rows, error } = await supabase
      .from("players")
      .select("id, player_account_id, first_name, last_name, jersey_number, position_group, season_stats")
      .eq("team_id", teamId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })

    if (error) {
      console.error("[GET /api/stats]", error)
      return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
    }

    const typedRows = (rows ?? []) as PlayerRow[]
    const seasonStatsRecord = (raw: unknown): Record<string, unknown> => {
      if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
        return raw as Record<string, unknown>
      }
      return {}
    }

    const players = typedRows.map((p) =>
      toPlayerStatsRow({
        id: p.id,
        playerAccountId: p.player_account_id,
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        jerseyNumber: p.jersey_number ?? null,
        positionGroup: p.position_group ?? null,
        seasonStats: seasonStatsRecord(p.season_stats),
      })
    )

    return NextResponse.json({ players })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[GET /api/stats] membership lookup failed", { error: err.message })
      return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json(
        { error: "You don't have access to this team's stats.", code: "TEAM_ACCESS_DENIED" },
        { status: 403 }
      )
    }
    console.error("[GET /api/stats]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
