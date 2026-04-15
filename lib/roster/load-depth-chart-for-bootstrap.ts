import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"

export type DepthChartBootstrapEntry = {
  id: string
  unit: string
  position: string
  string: number
  playerId: string | null
  player: {
    id: string
    firstName: string
    lastName: string
    jerseyNumber: number | null
    imageUrl: string | null
  } | null
  formation: string | null
  specialTeamType: string | null
}

/**
 * Same rows as GET /api/roster/depth-chart (for dashboard bootstrap / React Query cache).
 */
export async function loadDepthChartForBootstrap(teamId: string): Promise<DepthChartBootstrapEntry[]> {
  const supabase = getSupabaseServer()

  const { data: entries, error: entriesError } = await supabase
    .from("depth_chart_entries")
    .select("id, unit, position, string, player_id, formation, special_team_type")
    .eq("team_id", teamId)
    .order("unit", { ascending: true })
    .order("position", { ascending: true })
    .order("string", { ascending: true })

  if (entriesError) {
    console.error("[loadDepthChartForBootstrap] entries", entriesError.message)
    return []
  }

  const playerIds = [...new Set((entries ?? []).filter((e) => e.player_id).map((e) => e.player_id!))]
  let playersMap = new Map<
    string,
    { id: string; firstName: string; lastName: string; jerseyNumber: number | null; imageUrl: string | null }
  >()
  if (playerIds.length > 0) {
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number, image_url")
      .in("id", playerIds)
    if (!playersError && players) {
      playersMap = new Map(
        players.map((p) => [
          p.id,
          {
            id: p.id,
            firstName: p.first_name ?? "",
            lastName: p.last_name ?? "",
            jerseyNumber: p.jersey_number ?? null,
            imageUrl: normalizePlayerImageUrl(p.image_url) ?? null,
          },
        ])
      )
    }
  }

  return (entries ?? []).map((e) => ({
    id: e.id,
    unit: e.unit,
    position: e.position,
    string: e.string,
    playerId: e.player_id,
    player: e.player_id ? playersMap.get(e.player_id) || null : null,
    formation: e.formation || null,
    specialTeamType: e.special_team_type || null,
  }))
}
