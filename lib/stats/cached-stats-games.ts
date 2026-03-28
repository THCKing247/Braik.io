import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { mapDbGameRowToTeamGameRow } from "@/lib/team-game-row-map"
import type { TeamGameRow } from "@/lib/team-schedule-games"
import {
  lightweightCached,
  LW_TTL_STATS_GAMES,
  tagTeamStatsGames,
} from "@/lib/cache/lightweight-get-cache"

export type StatsGamesApiPayload = { games: TeamGameRow[] }

export type StatsGamesLoadOpts = {
  /** ISO timestamp — inclusive lower bound on `game_date` */
  startDate?: string | null
  /** ISO timestamp — inclusive upper bound on `game_date` */
  endDate?: string | null
}

/**
 * Columns required for schedule UI (scores, quarters, status, season grouping, CSV export).
 * `game_date` is the persisted kickoff time. `seasons(year)` is one FK hop for seasonYear.
 */
const GAMES_SCHEDULE_SELECT =
  "id, opponent, game_date, location, game_type, result, notes, conference_game, team_score, opponent_score, confirmed_by_coach, season_id, seasons(year), q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away"

async function loadStatsGamesForTeam(teamId: string, opts: StatsGamesLoadOpts = {}): Promise<StatsGamesApiPayload> {
  const supabase = getSupabaseServer()
  let q = supabase
    .from("games")
    .select(GAMES_SCHEDULE_SELECT)
    .eq("team_id", teamId)

  if (opts.startDate) {
    q = q.gte("game_date", opts.startDate)
  }
  if (opts.endDate) {
    q = q.lte("game_date", opts.endDate)
  }

  const { data: rows, error } = await q.order("game_date", { ascending: true })

  if (error) {
    throw new Error(error.message || "games query failed")
  }

  const games = (rows ?? []).map((r: Record<string, unknown>) => mapDbGameRowToTeamGameRow(r))
  return { games }
}

function cacheKeyParts(teamId: string, opts: StatsGamesLoadOpts): string[] {
  return [
    "stats-games-api-v2",
    teamId,
    opts.startDate?.trim() ?? "",
    opts.endDate?.trim() ?? "",
  ]
}

/**
 * Cached games list for GET /api/stats/games. Team-scoped; route enforces membership before calling.
 * Optional date bounds narrow rows (composite index on team_id + game_date).
 */
export function getCachedStatsGamesPayload(
  teamId: string,
  opts: StatsGamesLoadOpts = {}
): Promise<StatsGamesApiPayload> {
  return lightweightCached(
    cacheKeyParts(teamId, opts),
    { revalidate: LW_TTL_STATS_GAMES, tags: [tagTeamStatsGames(teamId)] },
    () => loadStatsGamesForTeam(teamId, opts)
  )
}
