import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { mapDbGameRowToTeamGameRow } from "@/lib/team-game-row-map"
import type { TeamGameRow } from "@/lib/team-schedule-games"
import {
  lightweightCached,
  LW_TTL_STATS_GAMES,
  tagTeamStatsGames,
} from "@/lib/cache/lightweight-get-cache"

export type StatsGamesApiPayload = { games: TeamGameRow[] }

async function loadStatsGamesForTeam(teamId: string): Promise<StatsGamesApiPayload> {
  const supabase = getSupabaseServer()
  const { data: rows, error } = await supabase
    .from("games")
    .select(
      "id, opponent, game_date, location, game_type, result, notes, conference_game, team_score, opponent_score, confirmed_by_coach, season_id, seasons(year), q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away"
    )
    .eq("team_id", teamId)
    .order("game_date", { ascending: true })

  if (error) {
    throw new Error(error.message || "games query failed")
  }

  const games = (rows ?? []).map((r: Record<string, unknown>) => mapDbGameRowToTeamGameRow(r))
  return { games }
}

/**
 * Cached games list for GET /api/stats/games. Team-scoped; route enforces membership before calling.
 */
export function getCachedStatsGamesPayload(teamId: string): Promise<StatsGamesApiPayload> {
  return lightweightCached(
    ["stats-games-api-v1", teamId],
    { revalidate: LW_TTL_STATS_GAMES, tags: [tagTeamStatsGames(teamId)] },
    () => loadStatsGamesForTeam(teamId)
  )
}
