/**
 * Single source for stat column labels: All Stats table, weekly table, CSV export, roster profile.
 * Pass INT = interceptions thrown (int_thrown). Def INT = defensive picks (interceptions).
 */
import type { PlayerStatsRow, StatsTableRow } from "@/lib/stats-helpers"

export const STATS_PLAYER_TABLE_COLUMNS: { key: keyof PlayerStatsRow; label: string; numeric: boolean }[] = [
  { key: "lastName", label: "Player", numeric: false },
  { key: "jerseyNumber", label: "#", numeric: true },
  { key: "position", label: "Position", numeric: false },
  { key: "gamesPlayed", label: "GP", numeric: true },
  { key: "passingYards", label: "Pass Yds", numeric: true },
  { key: "passingTds", label: "Pass TD", numeric: true },
  { key: "intThrown", label: "Pass INT", numeric: true },
  { key: "rushingYards", label: "Rush Yds", numeric: true },
  { key: "rushingTds", label: "Rush TD", numeric: true },
  { key: "receptions", label: "Rec", numeric: true },
  { key: "receivingYards", label: "Rec Yds", numeric: true },
  { key: "receivingTds", label: "Rec TD", numeric: true },
  { key: "tackles", label: "Tackles", numeric: true },
  { key: "sacks", label: "Sacks", numeric: true },
  { key: "interceptions", label: "Def INT", numeric: true },
]

export const STATS_WEEKLY_LEADING_COLUMNS: { key: keyof StatsTableRow; label: string; numeric: boolean }[] = [
  { key: "weekNumber", label: "Week", numeric: true },
  { key: "gameLabel", label: "Game", numeric: false },
  { key: "gameOpponent", label: "Opponent", numeric: false },
  { key: "gameDate", label: "Date", numeric: false },
]

/** Shared middle: numeric stat columns only (same for season + weekly exports). */
const STATS_CSV_STAT_HEADERS = [
  "GP",
  "Pass Yds",
  "Pass TD",
  "Pass INT",
  "Rush Yds",
  "Rush TD",
  "Rec",
  "Rec Yds",
  "Rec TD",
  "Tackles",
  "Sacks",
  "Def INT",
] as const

const STATS_CSV_PLAYER_HEADERS = ["First Name", "Last Name", "#", "Position"] as const

/** Season “All stats” CSV. Order matches export row builder on dashboard/stats. */
export const STATS_SEASON_CSV_HEADERS = [...STATS_CSV_PLAYER_HEADERS, "Side", ...STATS_CSV_STAT_HEADERS] as const

/** Weekly CSV: game context, then player id block (no side column). */
export const STATS_WEEKLY_CSV_HEADERS = [
  "Week",
  "Game",
  "Opponent",
  "Date",
  ...STATS_CSV_PLAYER_HEADERS,
  ...STATS_CSV_STAT_HEADERS,
] as const
