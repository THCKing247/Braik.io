/**
 * Canonical high-school football stat schema: keys synced from player_weekly_stat_entries → players.season_stats.
 * Derived metrics (completion %, etc.) live in lib/stats-derived.ts and are never stored on players.
 */

/** Aggregated with SUM across weekly rows (default). */
export const SYNCED_SEASON_STAT_KEYS = [
  "games_played",
  "pass_completions",
  "pass_attempts",
  "passing_yards",
  "passing_touchdowns",
  "int_thrown",
  "pass_long",
  "sacks_taken",
  "rush_attempts",
  "rushing_yards",
  "rushing_touchdowns",
  "rush_long",
  "receptions",
  "targets",
  "receiving_yards",
  "receiving_touchdowns",
  "rec_long",
  "solo_tackles",
  "assisted_tackles",
  /** Shared-credit TFL; may be fractional (e.g. 0.5). */
  "tackles_for_loss",
  /** Half sacks allowed (e.g. 0.5). */
  "sacks",
  "qb_hits",
  "pass_breakups",
  "defensive_interceptions",
  "forced_fumbles",
  "fumble_recoveries",
  "defensive_touchdowns",
  "safeties",
  "field_goals_made",
  "field_goals_attempted",
  "field_goal_long",
  "extra_points_made",
  "extra_points_attempted",
  "punts",
  "punt_yards",
  "punt_long",
  "kick_returns",
  "kick_return_yards",
  "kick_return_touchdowns",
  "punt_returns",
  "punt_return_yards",
  "punt_return_touchdowns",
] as const

export type SeasonStatKey = (typeof SYNCED_SEASON_STAT_KEYS)[number]

/** Use MAX across weekly rows (season “long” / best single-game value). */
export const MAX_AGGREGATION_STAT_KEYS = new Set<string>([
  "pass_long",
  "rush_long",
  "rec_long",
  "field_goal_long",
  "punt_long",
])

/** Accepted on weekly JSON/CSV; merged into canonical keys on write + read. */
export const LEGACY_WEEKLY_STAT_KEYS = [
  "passing_tds",
  "rushing_tds",
  "receiving_tds",
  "interceptions",
  "tackles",
] as const

export type LegacyWeeklyStatKey = (typeof LEGACY_WEEKLY_STAT_KEYS)[number]

/** Add-weekly dialog / docs: which canonical keys belong to which section. */
export const WEEKLY_FORM_SECTIONS: { id: string; label: string; keys: readonly SeasonStatKey[] }[] = [
  { id: "general", label: "General", keys: ["games_played"] },
  {
    id: "passing",
    label: "Passing",
    keys: [
      "pass_completions",
      "pass_attempts",
      "passing_yards",
      "passing_touchdowns",
      "int_thrown",
      "pass_long",
      "sacks_taken",
    ],
  },
  {
    id: "rushing",
    label: "Rushing",
    keys: ["rush_attempts", "rushing_yards", "rushing_touchdowns", "rush_long"],
  },
  {
    id: "receiving",
    label: "Receiving",
    keys: ["receptions", "targets", "receiving_yards", "receiving_touchdowns", "rec_long"],
  },
  {
    id: "defense",
    label: "Defense",
    keys: [
      "solo_tackles",
      "assisted_tackles",
      "tackles_for_loss",
      "sacks",
      "qb_hits",
      "pass_breakups",
      "defensive_interceptions",
      "forced_fumbles",
      "fumble_recoveries",
      "defensive_touchdowns",
      "safeties",
    ],
  },
  {
    id: "special",
    label: "Special teams",
    keys: [
      "field_goals_made",
      "field_goals_attempted",
      "field_goal_long",
      "extra_points_made",
      "extra_points_attempted",
      "punts",
      "punt_yards",
      "punt_long",
      "kick_returns",
      "kick_return_yards",
      "kick_return_touchdowns",
      "punt_returns",
      "punt_return_yards",
      "punt_return_touchdowns",
    ],
  },
]

/** Profile season cards: same groupings (subset labels via stats-season-labels). */
export const PROFILE_SEASON_GROUPS: { label: string; keys: readonly SeasonStatKey[] }[] = WEEKLY_FORM_SECTIONS.map(
  ({ label, keys }) => ({ label, keys })
)
