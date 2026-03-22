/**
 * Stat field definitions for CSV import and UI labels.
 *
 * **Production import** uses `STATS_WEEKLY_IMPORT_HEADERS` and weekly row APIs; synced keys
 * (`SEASON_STAT_KEYS`) are written only via `player_weekly_stat_entries` + recalculation.
 *
 * `STATS_IMPORT_HEADERS` (identity + stat columns, no week/game context) remains for unit tests
 * and legacy parsers in `lib/stats-import.ts` — not used by POST /api/stats/import.
 * Keep DB keys in sync with `players.season_stats` JSONB (e.g. int_thrown not interceptions_thrown).
 *
 * Display labels align with `lib/stats-season-labels.ts` and table/CSV in `lib/stats-display-columns.ts`.
 */

import { SEASON_STAT_DB_KEY_LABEL } from "@/lib/stats-season-labels"

export const IDENTITY_COLUMNS = [
  "player_id",
  "first_name",
  "last_name",
  "jersey_number",
  "position",
] as const

/** Stat fields: csvHeader (template/CSV), dbKey (season_stats JSONB), label (UI). */
export const STAT_IMPORT_FIELDS = [
  { csvHeader: "passing_yards", dbKey: "passing_yards", label: SEASON_STAT_DB_KEY_LABEL.passing_yards },
  { csvHeader: "passing_tds", dbKey: "passing_tds", label: SEASON_STAT_DB_KEY_LABEL.passing_tds },
  { csvHeader: "interceptions_thrown", dbKey: "int_thrown", label: SEASON_STAT_DB_KEY_LABEL.int_thrown },
  { csvHeader: "rushing_yards", dbKey: "rushing_yards", label: SEASON_STAT_DB_KEY_LABEL.rushing_yards },
  { csvHeader: "rushing_tds", dbKey: "rushing_tds", label: SEASON_STAT_DB_KEY_LABEL.rushing_tds },
  { csvHeader: "receiving_yards", dbKey: "receiving_yards", label: SEASON_STAT_DB_KEY_LABEL.receiving_yards },
  { csvHeader: "receiving_tds", dbKey: "receiving_tds", label: SEASON_STAT_DB_KEY_LABEL.receiving_tds },
  { csvHeader: "tackles", dbKey: "tackles", label: SEASON_STAT_DB_KEY_LABEL.tackles },
  { csvHeader: "sacks", dbKey: "sacks", label: SEASON_STAT_DB_KEY_LABEL.sacks },
  { csvHeader: "interceptions", dbKey: "interceptions", label: SEASON_STAT_DB_KEY_LABEL.interceptions },
  { csvHeader: "games_played", dbKey: "games_played", label: SEASON_STAT_DB_KEY_LABEL.games_played },
] as const

/** All CSV headers in order: identity columns then stat columns. */
export const STATS_IMPORT_HEADERS = [
  ...IDENTITY_COLUMNS,
  ...STAT_IMPORT_FIELDS.map((f) => f.csvHeader),
] as const

/** Weekly/game entry import: identity + context + stat columns (order for templates/docs). */
export const WEEKLY_CONTEXT_CSV_HEADERS = [
  "season_year",
  "week_number",
  "game_id",
  "opponent",
  "game_date",
] as const

export const STATS_WEEKLY_IMPORT_HEADERS = [
  ...IDENTITY_COLUMNS,
  ...WEEKLY_CONTEXT_CSV_HEADERS,
  ...STAT_IMPORT_FIELDS.map((f) => f.csvHeader),
] as const

/** Map CSV header (and common alias) -> season_stats db key. */
export function getStatDbKeyByCsvHeader(csvHeader: string): string | null {
  const normalized = csvHeader.trim().toLowerCase().replace(/\s+/g, "_")
  const f = STAT_IMPORT_FIELDS.find(
    (x) => x.csvHeader === normalized || x.csvHeader.replace("interceptions_thrown", "int_thrown") === normalized
  )
  if (f) return f.dbKey
  if (normalized === "int_thrown") return "int_thrown"
  return null
}

/** Map of dbKey -> label for UI (includes keys not in CSV template). */
export const STAT_LABELS_BY_DB_KEY: Record<string, string> = {
  ...SEASON_STAT_DB_KEY_LABEL,
  ...Object.fromEntries(STAT_IMPORT_FIELDS.map((f) => [f.dbKey, f.label] as const)),
}

/** CSV header -> db key for validation/merge. Includes int_thrown as alias. */
export const CSV_HEADER_TO_DB_KEY: Record<string, string> = Object.fromEntries([
  ...STAT_IMPORT_FIELDS.map((f) => [f.csvHeader, f.dbKey]),
  ["int_thrown", "int_thrown"],
  ["receptions", "receptions"],
])

/** Keys covered by stat columns in CSV helpers / legacy merge (tests); production import uses weekly path. */
export const STAT_DB_KEYS = [...new Set([...STAT_IMPORT_FIELDS.map((f) => f.dbKey), "receptions"])] as readonly string[]

/** Max CSV file size in bytes (2MB). Used by import route. */
export const STATS_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024

/** Max data rows (excluding header) per import. */
export const STATS_IMPORT_MAX_DATA_ROWS = 2000
