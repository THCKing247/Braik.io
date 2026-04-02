import type { TeamGameRow } from "@/lib/team-schedule-games"

/** Coerce Postgres numeric / string JSON values into integers for the UI. */
function coerceInt(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

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
    teamScore: coerceInt(r.team_score),
    opponentScore: coerceInt(r.opponent_score),
    confirmedByCoach: Boolean(r.confirmed_by_coach),
    q1_home: coerceInt(r.q1_home),
    q2_home: coerceInt(r.q2_home),
    q3_home: coerceInt(r.q3_home),
    q4_home: coerceInt(r.q4_home),
    q1_away: coerceInt(r.q1_away),
    q2_away: coerceInt(r.q2_away),
    q3_away: coerceInt(r.q3_away),
    q4_away: coerceInt(r.q4_away),
  }
}
