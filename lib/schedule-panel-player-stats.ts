import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"

export type MergedPanelPlayerStat = {
  playerId: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  imageUrl: string | null
  stats: Record<string, unknown>
}

/**
 * Schedule + POTG read stats from `player_weekly_stat_entries` (game_id) — the same rows as All Stats.
 * `player_game_stats` is merged for legacy/extra rows; weekly values win on key conflicts.
 */
export async function loadMergedPlayerStatsForScheduleGame(
  supabase: SupabaseClient,
  teamId: string,
  gameId: string
): Promise<MergedPanelPlayerStat[]> {
  const [weeklyRes, pgsRes] = await Promise.all([
    supabase
      .from("player_weekly_stat_entries")
      .select("player_id, stats")
      .eq("team_id", teamId)
      .eq("game_id", gameId)
      .is("deleted_at", null),
    supabase.from("player_game_stats").select("player_id, stats").eq("team_id", teamId).eq("game_id", gameId),
  ])

  if (weeklyRes.error) {
    console.error("[loadMergedPlayerStats] weekly", weeklyRes.error)
    throw new Error("Failed to load weekly stat entries")
  }
  if (pgsRes.error) {
    console.error("[loadMergedPlayerStats] player_game_stats", pgsRes.error)
    throw new Error("Failed to load player game stats")
  }

  const byPlayer = new Map<string, Record<string, unknown>>()

  for (const r of pgsRes.data ?? []) {
    const pid = r.player_id as string
    const s = (r.stats as Record<string, unknown>) ?? {}
    byPlayer.set(pid, { ...s })
  }

  for (const r of weeklyRes.data ?? []) {
    const pid = r.player_id as string
    const w = (r.stats as Record<string, unknown>) ?? {}
    const prev = byPlayer.get(pid) ?? {}
    byPlayer.set(pid, { ...prev, ...w })
  }

  const playerIds = [...byPlayer.keys()]
  if (playerIds.length === 0) return []

  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, first_name, last_name, jersey_number, position_group, image_url")
    .eq("team_id", teamId)
    .in("id", playerIds)

  if (pErr) {
    console.error("[loadMergedPlayerStats] players", pErr)
    throw new Error("Failed to load players")
  }

  const pmap = new Map((players ?? []).map((p) => [p.id as string, p]))

  return playerIds.map((pid) => {
    const pl = pmap.get(pid)
    return {
      playerId: pid,
      firstName: (pl?.first_name as string) ?? "",
      lastName: (pl?.last_name as string) ?? "",
      jerseyNumber: (pl?.jersey_number as number | null) ?? null,
      positionGroup: (pl?.position_group as string | null) ?? null,
      imageUrl: normalizePlayerImageUrl((pl?.image_url as string | null) ?? null),
      stats: byPlayer.get(pid) ?? {},
    }
  })
}
