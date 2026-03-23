/**
 * GET — recap metadata + per-game player stats for the schedule expanded panel.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"

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
    const { data: game } = await supabase
      .from("games")
      .select("id, ai_recap, ai_recap_at, potg_override_player_id")
      .eq("id", gameId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const { data: statRows, error: statErr } = await supabase
      .from("player_game_stats")
      .select("player_id, stats")
      .eq("game_id", gameId)
      .eq("team_id", teamId)

    if (statErr) {
      console.error("[schedule-panel GET] player_game_stats", statErr)
      return NextResponse.json({ error: "Failed to load player stats" }, { status: 500 })
    }

    const playerIds = [...new Set((statRows ?? []).map((r) => r.player_id as string))]
    let playersById: Record<
      string,
      {
        first_name: string
        last_name: string
        jersey_number: number | null
        position_group: string | null
        image_url: string | null
      }
    > = {}

    if (playerIds.length > 0) {
      const { data: players, error: pErr } = await supabase
        .from("players")
        .select("id, first_name, last_name, jersey_number, position_group, image_url")
        .eq("team_id", teamId)
        .in("id", playerIds)

      if (pErr) {
        console.error("[schedule-panel GET] players", pErr)
        return NextResponse.json({ error: "Failed to load players" }, { status: 500 })
      }
      for (const p of players ?? []) {
        playersById[p.id as string] = {
          first_name: (p.first_name as string) ?? "",
          last_name: (p.last_name as string) ?? "",
          jersey_number: (p.jersey_number as number | null) ?? null,
          position_group: (p.position_group as string | null) ?? null,
          image_url: (p.image_url as string | null) ?? null,
        }
      }
    }

    let overridePlayer: { id: string; firstName: string; lastName: string } | null = null
    const oid = game.potg_override_player_id as string | null | undefined
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

    const playerStats = (statRows ?? []).map((r) => {
      const pid = r.player_id as string
      const pl = playersById[pid]
      return {
        playerId: pid,
        firstName: pl?.first_name ?? "",
        lastName: pl?.last_name ?? "",
        jerseyNumber: pl?.jersey_number ?? null,
        positionGroup: pl?.position_group ?? null,
        imageUrl: normalizePlayerImageUrl(pl?.image_url ?? null),
        stats: (r.stats as Record<string, unknown>) ?? {},
      }
    })

    return NextResponse.json({
      aiRecap: (game.ai_recap as string | null) ?? null,
      aiRecapAt: (game.ai_recap_at as string | null) ?? null,
      potgOverridePlayerId: (game.potg_override_player_id as string | null) ?? null,
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
