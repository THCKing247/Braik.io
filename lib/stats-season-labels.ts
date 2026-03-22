/**
 * Human-readable labels for season_stats JSONB keys (profile cards, import dialog, docs).
 * Keep in sync with SEASON_STAT_KEYS in stats-helpers.
 */
import type { SeasonStatKey } from "@/lib/stats-helpers"

export const SEASON_STAT_DB_KEY_LABEL: Record<SeasonStatKey, string> = {
  games_played: "Games played",
  passing_yards: "Passing yards",
  passing_tds: "Passing TDs",
  int_thrown: "Pass INT (thrown)",
  rushing_yards: "Rushing yards",
  rushing_tds: "Rushing TDs",
  receptions: "Receptions",
  receiving_yards: "Receiving yards",
  receiving_tds: "Receiving TDs",
  touchdowns: "Touchdowns",
  tackles: "Tackles",
  sacks: "Sacks",
  interceptions: "Def INT",
}

export function labelForSeasonStatDbKey(key: string): string {
  if (key in SEASON_STAT_DB_KEY_LABEL) {
    return SEASON_STAT_DB_KEY_LABEL[key as SeasonStatKey]
  }
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
