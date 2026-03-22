/**
 * Single source for stat column labels: All Stats table, weekly table, CSV export, roster profile weekly table.
 * Pass INT = int_thrown. Def INT = defensive_interceptions.
 */
import type { PlayerStatsRow, StatsTableRow } from "@/lib/stats-helpers"

export const STATS_PLAYER_TABLE_COLUMNS: { key: keyof PlayerStatsRow; label: string; numeric: boolean }[] = [
  { key: "lastName", label: "Player", numeric: false },
  { key: "jerseyNumber", label: "#", numeric: true },
  { key: "position", label: "Position", numeric: false },
  { key: "gamesPlayed", label: "GP", numeric: true },
  { key: "passCompletions", label: "Pass Comp", numeric: true },
  { key: "passAttempts", label: "Pass Att", numeric: true },
  { key: "passingYards", label: "Pass Yds", numeric: true },
  { key: "passingTouchdowns", label: "Pass TD", numeric: true },
  { key: "intThrown", label: "Pass INT", numeric: true },
  { key: "passLong", label: "Pass Long", numeric: true },
  { key: "sacksTaken", label: "Sk Taken", numeric: true },
  { key: "rushAttempts", label: "Rush Att", numeric: true },
  { key: "rushingYards", label: "Rush Yds", numeric: true },
  { key: "rushingTouchdowns", label: "Rush TD", numeric: true },
  { key: "rushLong", label: "Rush Long", numeric: true },
  { key: "receptions", label: "Rec", numeric: true },
  { key: "targets", label: "Tgt", numeric: true },
  { key: "receivingYards", label: "Rec Yds", numeric: true },
  { key: "receivingTouchdowns", label: "Rec TD", numeric: true },
  { key: "recLong", label: "Rec Long", numeric: true },
  { key: "soloTackles", label: "Solo", numeric: true },
  { key: "assistedTackles", label: "Ast", numeric: true },
  { key: "tacklesForLoss", label: "TFL", numeric: true },
  { key: "sacks", label: "Sacks", numeric: true },
  { key: "qbHits", label: "QB Hits", numeric: true },
  { key: "passBreakups", label: "PBU", numeric: true },
  { key: "defensiveInterceptions", label: "Def INT", numeric: true },
  { key: "forcedFumbles", label: "FF", numeric: true },
  { key: "fumbleRecoveries", label: "FR", numeric: true },
  { key: "defensiveTouchdowns", label: "Def TD", numeric: true },
  { key: "safeties", label: "Saf", numeric: true },
  { key: "fieldGoalsMade", label: "FGM", numeric: true },
  { key: "fieldGoalsAttempted", label: "FGA", numeric: true },
  { key: "fieldGoalLong", label: "FG Long", numeric: true },
  { key: "extraPointsMade", label: "XPM", numeric: true },
  { key: "extraPointsAttempted", label: "XPA", numeric: true },
  { key: "punts", label: "Punts", numeric: true },
  { key: "puntYards", label: "Punt Yds", numeric: true },
  { key: "puntLong", label: "Punt Long", numeric: true },
  { key: "kickReturns", label: "K Ret", numeric: true },
  { key: "kickReturnYards", label: "K Ret Yds", numeric: true },
  { key: "kickReturnTouchdowns", label: "K Ret TD", numeric: true },
  { key: "puntReturns", label: "P Ret", numeric: true },
  { key: "puntReturnYards", label: "P Ret Yds", numeric: true },
  { key: "puntReturnTouchdowns", label: "P Ret TD", numeric: true },
]

const STATS_CSV_STAT_HEADERS = STATS_PLAYER_TABLE_COLUMNS.filter((c) => c.key !== "lastName").map((c) => c.label)

const STATS_CSV_PLAYER_HEADERS = ["First Name", "Last Name", "#", "Position"] as const

/** Season “All stats” CSV. Order matches `buildSeasonStatsCsvRow`. */
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

export const STATS_WEEKLY_LEADING_COLUMNS: { key: keyof StatsTableRow; label: string; numeric: boolean }[] = [
  { key: "weekNumber", label: "Week", numeric: true },
  { key: "gameLabel", label: "Game", numeric: false },
  { key: "gameOpponent", label: "Opponent", numeric: false },
  { key: "gameDate", label: "Date", numeric: false },
]

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

function fmtStr(v: string | null | undefined): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

/** Stat cells only (same order as STATS_CSV_STAT_HEADERS / table minus identity). */
export function buildStatsValueCells(r: PlayerStatsRow): string[] {
  return STATS_PLAYER_TABLE_COLUMNS.filter((c) => c.key !== "lastName").map((c) => fmt(r[c.key as keyof PlayerStatsRow] as number | null))
}

export function buildSeasonStatsCsvRow(r: PlayerStatsRow): string[] {
  return [
    r.firstName,
    r.lastName,
    fmt(r.jerseyNumber),
    r.position ?? "",
    r.sideOfBall ?? "",
    ...buildStatsValueCells(r),
  ]
}

export function buildWeeklyStatsCsvRow(r: StatsTableRow): string[] {
  return [
    fmt(r.weekNumber ?? null),
    fmtStr(r.gameLabel),
    fmtStr(r.gameOpponent),
    r.gameDate ? String(r.gameDate).slice(0, 10) : "",
    r.firstName,
    r.lastName,
    fmt(r.jerseyNumber),
    r.position ?? "",
    ...buildStatsValueCells(r),
  ]
}
