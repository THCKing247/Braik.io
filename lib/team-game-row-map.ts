import type { TeamGameRow } from "@/lib/team-schedule-games"

/** Map a Supabase `games` row (+ nested `seasons`) to `TeamGameRow`. */
export function mapDbGameRowToTeamGameRow(r: Record<string, unknown>): TeamGameRow {
  const seasons = r.seasons as { year?: number } | null | undefined
  return {
    id: r.id as string,
    opponent: (r.opponent as string) ?? "",
    gameDate: r.game_date as string,
    location: (r.location as string | null) ?? null,
    gameType: (r.game_type as string | null) ?? null,
    result: (r.result as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    seasonYear: seasons?.year ?? null,
    conferenceGame: Boolean(r.conference_game),
    teamScore: (r.team_score as number | null) ?? null,
    opponentScore: (r.opponent_score as number | null) ?? null,
    confirmedByCoach: Boolean(r.confirmed_by_coach),
    q1_home: (r.q1_home as number | null) ?? null,
    q2_home: (r.q2_home as number | null) ?? null,
    q3_home: (r.q3_home as number | null) ?? null,
    q4_home: (r.q4_home as number | null) ?? null,
    q1_away: (r.q1_away as number | null) ?? null,
    q2_away: (r.q2_away as number | null) ?? null,
    q3_away: (r.q3_away as number | null) ?? null,
    q4_away: (r.q4_away as number | null) ?? null,
  }
}
