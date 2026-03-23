/**
 * GET — recap metadata + per-game player stats for the schedule expanded panel.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { loadMergedPlayerStatsForScheduleGame } from "@/lib/schedule-panel-player-stats"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; gameId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameId } = await params
    if (!teamId?.trim() || !gameId?.trim()) {
      return NextResponse.json({ error: "teamId and gameId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: gameRow, error: gameErr } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (gameErr || !gameRow) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    let aiRecap: string | null = null
    let aiRecapAt: string | null = null
    let potgOverridePlayerId: string | null = null

    const intel = await supabase
      .from("games")
      .select("ai_recap, ai_recap_at, potg_override_player_id")
      .eq("id", gameId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!intel.error && intel.data) {
      aiRecap = (intel.data.ai_recap as string | null) ?? null
      aiRecapAt = (intel.data.ai_recap_at as string | null) ?? null
      potgOverridePlayerId = (intel.data.potg_override_player_id as string | null) ?? null
    } else if (intel.error) {
      const msg = String(intel.error.message ?? "")
      if (!msg.includes("column") && !msg.includes("schema cache")) {
        console.warn("[schedule-panel GET] optional intel columns", intel.error)
      }
    }

    let playerStats
    try {
      playerStats = await loadMergedPlayerStatsForScheduleGame(supabase, teamId, gameId)
    } catch (e) {
      console.error("[schedule-panel GET] merged stats", e)
      return NextResponse.json({ error: "Failed to load player stats" }, { status: 500 })
    }

    let overridePlayer: { id: string; firstName: string; lastName: string } | null = null
    const oid = potgOverridePlayerId
    if (oid) {
      const { data: op } = await supabase
        .from("players")
        .select("id, first_name, last_name")
        .eq("id", oid)
        .eq("team_id", teamId)
        .maybeSingle()
      if (op) {
        overridePlayer = {
          id: op.id as string,
          firstName: (op.first_name as string) ?? "",
          lastName: (op.last_name as string) ?? "",
        }
      }
    }

    return NextResponse.json({
      aiRecap,
      aiRecapAt,
      potgOverridePlayerId,
      potgOverridePlayer: overridePlayer,
      playerStats,
    })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[GET schedule-panel]", err)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}
