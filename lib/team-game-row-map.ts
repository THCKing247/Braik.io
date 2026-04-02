import { type TeamGameRow, parseGameNumericField } from "@/lib/team-schedule-games"

/** Map a Supabase `games` row (+ nested `seasons`) to `TeamGameRow`. */
export function mapDbGameRowToTeamGameRow(r: Record<string, unknown>): TeamGameRow {
  const seasons = r.seasons as { year?: number } | null | undefined
  return {
    id: r.id as string,
    opponent: (r.opponent as string) ?? "",
    gameDate: (r.game_date as string) ?? "",
    location: (r.location as string | null) ?? null,
    gameType: (r.game_type as string | null) ?? null,
    result: (r.result as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    seasonYear: seasons?.year ?? null,
    conferenceGame: Boolean(r.conference_game),
    teamScore: parseGameNumericField(r.team_score),
    opponentScore: parseGameNumericField(r.opponent_score),
    confirmedByCoach: Boolean(r.confirmed_by_coach),
    q1_home: parseGameNumericField(r.q1_home),
    q2_home: parseGameNumericField(r.q2_home),
    q3_home: parseGameNumericField(r.q3_home),
    q4_home: parseGameNumericField(r.q4_home),
    q1_away: parseGameNumericField(r.q1_away),
    q2_away: parseGameNumericField(r.q2_away),
    q3_away: parseGameNumericField(r.q3_away),
    q4_away: parseGameNumericField(r.q4_away),
  }
}
