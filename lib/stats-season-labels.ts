/**
 * Human-readable labels for season_stats JSONB keys (profile cards, import dialog, docs).
 * Keep in sync with SYNCED_SEASON_STAT_KEYS in lib/stats-schema.ts.
 */
import type { SeasonStatKey } from "@/lib/stats-schema"

export const SEASON_STAT_DB_KEY_LABEL: Record<SeasonStatKey, string> = {
  games_played: "Games played",
  pass_completions: "Pass completions",
  pass_attempts: "Pass attempts",
  passing_yards: "Passing yards",
  passing_touchdowns: "Passing touchdowns",
  int_thrown: "Pass INT (thrown)",
  pass_long: "Pass long",
  sacks_taken: "Sacks taken",
  rush_attempts: "Rush attempts",
  rushing_yards: "Rushing yards",
  rushing_touchdowns: "Rushing touchdowns",
  rush_long: "Rush long",
  receptions: "Receptions",
  targets: "Targets",
  receiving_yards: "Receiving yards",
  receiving_touchdowns: "Receiving touchdowns",
  rec_long: "Reception long",
  solo_tackles: "Solo tackles",
  assisted_tackles: "Assisted tackles",
  tackles_for_loss: "Tackles for loss",
  sacks: "Sacks",
  qb_hits: "QB hits",
  pass_breakups: "Pass breakups",
  defensive_interceptions: "Def INT",
  forced_fumbles: "Forced fumbles",
  fumble_recoveries: "Fumble recoveries",
  defensive_touchdowns: "Defensive touchdowns",
  safeties: "Safeties",
  field_goals_made: "Field goals made",
  field_goals_attempted: "Field goals attempted",
  field_goal_long: "Field goal long",
  extra_points_made: "Extra points made",
  extra_points_attempted: "Extra points attempted",
  punts: "Punts",
  punt_yards: "Punt yards",
  punt_long: "Punt long",
  kick_returns: "Kick returns",
  kick_return_yards: "Kick return yards",
  kick_return_touchdowns: "Kick return touchdowns",
  punt_returns: "Punt returns",
  punt_return_yards: "Punt return yards",
  punt_return_touchdowns: "Punt return touchdowns",
}

export function labelForSeasonStatDbKey(key: string): string {
  if (key in SEASON_STAT_DB_KEY_LABEL) {
    return SEASON_STAT_DB_KEY_LABEL[key as SeasonStatKey]
  }
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
