/**
 * Stat field definitions for CSV import and UI labels.
 *
 * **Production import** uses `STATS_WEEKLY_IMPORT_HEADERS` and weekly row APIs; synced keys
 * are written only via `player_weekly_stat_entries` + recalculation.
 *
 * `STATS_IMPORT_HEADERS` (identity + stat columns) remains for unit tests / legacy parsers.
 *
 * Display labels align with `lib/stats-season-labels.ts` and table/CSV in `lib/stats-display-columns.ts`.
 */

import { SYNCED_SEASON_STAT_KEYS } from "@/lib/stats-schema"
import { SEASON_STAT_DB_KEY_LABEL } from "@/lib/stats-season-labels"

export const IDENTITY_COLUMNS = [
  "player_id",
  "first_name",
  "last_name",
  "jersey_number",
  "position",
] as const

/** Stat fields: csvHeader (template/CSV), dbKey (parsed row / JSON before normalize), label (UI). */
export const STAT_IMPORT_FIELDS = SYNCED_SEASON_STAT_KEYS.map((dbKey) => ({
  csvHeader: dbKey,
  dbKey: dbKey as string,
  label: SEASON_STAT_DB_KEY_LABEL[dbKey],
})) as readonly { readonly csvHeader: string; readonly dbKey: string; readonly label: string }[]

/** Legacy CSV headers → intermediate keys merged by `normalizeWeeklyStatsForStorage`. */
export const LEGACY_STAT_CSV_ALIASES: Record<string, string> = {
  passing_tds: "passing_tds",
  rushing_tds: "rushing_tds",
  receiving_tds: "receiving_tds",
  interceptions: "interceptions",
  tackles: "tackles",
}

/** All CSV headers in order: identity columns then stat columns (legacy season import tests). */
export const STATS_IMPORT_HEADERS = [
  ...IDENTITY_COLUMNS,
  ...STAT_IMPORT_FIELDS.map((f) => f.csvHeader),
] as const

/** Weekly/game entry import: identity + context + stat columns. */
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

/** Map CSV header (normalized) → key stored on parsed row `stats` (canonical or legacy). */
export const CSV_HEADER_TO_DB_KEY: Record<string, string> = {
  ...Object.fromEntries(STAT_IMPORT_FIELDS.map((f) => [f.csvHeader, f.dbKey] as const)),
  ...LEGACY_STAT_CSV_ALIASES,
  int_thrown: "int_thrown",
  receptions: "receptions",
}

/** Map of dbKey → label for UI. */
export const STAT_LABELS_BY_DB_KEY: Record<string, string> = {
  ...SEASON_STAT_DB_KEY_LABEL,
  ...Object.fromEntries(STAT_IMPORT_FIELDS.map((f) => [f.dbKey, f.label] as const)),
  passing_tds: "Passing touchdowns (legacy column)",
  rushing_tds: "Rushing touchdowns (legacy column)",
  receiving_tds: "Receiving touchdowns (legacy column)",
  interceptions: "Def INT (legacy column)",
  tackles: "Tackles (legacy total → solo)",
}

/** Map CSV header → db key for validation/merge. */
export function getStatDbKeyByCsvHeader(csvHeader: string): string | null {
  const normalized = csvHeader.trim().toLowerCase().replace(/\s+/g, "_")
  if (normalized in CSV_HEADER_TO_DB_KEY) return CSV_HEADER_TO_DB_KEY[normalized]
  if (normalized === "interceptions_thrown") return "int_thrown"
  return null
}

/** Keys covered by stat columns in CSV helpers / legacy merge (tests). */
export const STAT_DB_KEYS = [...new Set(Object.values(CSV_HEADER_TO_DB_KEY))] as readonly string[]

/** Max CSV file size in bytes (2MB). Used by import route. */
export const STATS_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024

/** Max data rows (excluding header) per import. */
export const STATS_IMPORT_MAX_DATA_ROWS = 2000
