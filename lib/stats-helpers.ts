/**
 * Shared types and helpers for team All Stats page.
 * Reads from players.season_stats (JSONB) and players profile fields.
 */
export type { SeasonStatKey } from "@/lib/stats-schema"
export { SYNCED_SEASON_STAT_KEYS as SEASON_STAT_KEYS } from "@/lib/stats-schema"
import type { SeasonStatKey } from "@/lib/stats-schema"

export type SideOfBall = "offense" | "defense" | "special" | null

const OFFENSE_POSITIONS = ["QB", "RB", "WR", "TE", "OL", "FB", "HB"]
const DEFENSE_POSITIONS = ["DL", "LB", "DB", "DE", "DT", "OLB", "MLB", "ILB", "CB", "S"]
const SPECIAL_POSITIONS = ["K", "P"]

export function getPositionSide(positionGroup: string | null): SideOfBall {
  if (!positionGroup) return null
  const pos = positionGroup.toUpperCase()
  if (OFFENSE_POSITIONS.includes(pos)) return "offense"
  if (DEFENSE_POSITIONS.includes(pos)) return "defense"
  if (SPECIAL_POSITIONS.includes(pos)) return "special"
  return null
}

/** Extract numeric value from season_stats (flat keys). */
export function getStatNumber(
  seasonStats: Record<string, unknown> | null | undefined,
  key: string
): number | null {
  if (!seasonStats || typeof seasonStats !== "object") return null
  const raw = seasonStats[key]
  if (raw === undefined || raw === null || raw === "") return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function mergeLegacyPair(
  stats: Record<string, unknown>,
  canonical: string,
  legacy: string
): number | null {
  const a = getStatNumber(stats, canonical)
  const b = getStatNumber(stats, legacy)
  if (a !== null && b !== null) return a + b
  return a ?? b ?? null
}

function readSoloTackles(stats: Record<string, unknown>): number | null {
  const solo = getStatNumber(stats, "solo_tackles")
  if (solo !== null) return solo
  const legacy = getStatNumber(stats, "tackles")
  const ast = getStatNumber(stats, "assisted_tackles")
  if (legacy !== null && ast === null) return legacy
  return null
}

function readAssistedTackles(stats: Record<string, unknown>): number | null {
  return getStatNumber(stats, "assisted_tackles")
}

/** One row for the All Stats table (profile + aggregated stats). */
export interface PlayerStatsRow {
  id: string
  /** Canonical roster URL segment when provided by API (not the internal UUID). */
  playerAccountId?: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  position: string | null
  sideOfBall: SideOfBall
  gamesPlayed: number | null
  passCompletions: number | null
  passAttempts: number | null
  passingYards: number | null
  passingTouchdowns: number | null
  intThrown: number | null
  passLong: number | null
  sacksTaken: number | null
  rushAttempts: number | null
  rushingYards: number | null
  rushingTouchdowns: number | null
  rushLong: number | null
  receptions: number | null
  targets: number | null
  receivingYards: number | null
  receivingTouchdowns: number | null
  recLong: number | null
  soloTackles: number | null
  assistedTackles: number | null
  /** May include half values (e.g. 0.5) when crediting shared TFL. */
  tacklesForLoss: number | null
  /** May include half sacks (e.g. 0.5) when crediting shared sacks. */
  sacks: number | null
  qbHits: number | null
  passBreakups: number | null
  defensiveInterceptions: number | null
  forcedFumbles: number | null
  fumbleRecoveries: number | null
  defensiveTouchdowns: number | null
  safeties: number | null
  fieldGoalsMade: number | null
  fieldGoalsAttempted: number | null
  fieldGoalLong: number | null
  extraPointsMade: number | null
  extraPointsAttempted: number | null
  punts: number | null
  puntYards: number | null
  puntLong: number | null
  kickReturns: number | null
  kickReturnYards: number | null
  kickReturnTouchdowns: number | null
  puntReturns: number | null
  puntReturnYards: number | null
  puntReturnTouchdowns: number | null
}

/** Build a PlayerStatsRow from API player + season_stats (supports legacy JSON keys). */
export function toPlayerStatsRow(p: {
  id: string
  playerAccountId?: string | null
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  seasonStats?: Record<string, unknown> | null
}): PlayerStatsRow {
  const stats = p.seasonStats && typeof p.seasonStats === "object" ? p.seasonStats : {}
  const ast = readAssistedTackles(stats)

  return {
    id: p.id,
    ...(p.playerAccountId?.trim()
      ? { playerAccountId: p.playerAccountId.trim() }
      : {}),
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    jerseyNumber: p.jerseyNumber ?? null,
    position: p.positionGroup ?? null,
    sideOfBall: getPositionSide(p.positionGroup ?? null),
    gamesPlayed: getStatNumber(stats, "games_played"),
    passCompletions: getStatNumber(stats, "pass_completions"),
    passAttempts: getStatNumber(stats, "pass_attempts"),
    passingYards: getStatNumber(stats, "passing_yards"),
    passingTouchdowns: mergeLegacyPair(stats, "passing_touchdowns", "passing_tds"),
    intThrown: getStatNumber(stats, "int_thrown"),
    passLong: getStatNumber(stats, "pass_long"),
    sacksTaken: getStatNumber(stats, "sacks_taken"),
    rushAttempts: getStatNumber(stats, "rush_attempts"),
    rushingYards: getStatNumber(stats, "rushing_yards"),
    rushingTouchdowns: mergeLegacyPair(stats, "rushing_touchdowns", "rushing_tds"),
    rushLong: getStatNumber(stats, "rush_long"),
    receptions: getStatNumber(stats, "receptions"),
    targets: getStatNumber(stats, "targets"),
    receivingYards: getStatNumber(stats, "receiving_yards"),
    receivingTouchdowns: mergeLegacyPair(stats, "receiving_touchdowns", "receiving_tds"),
    recLong: getStatNumber(stats, "rec_long"),
    soloTackles: readSoloTackles(stats),
    assistedTackles: ast,
    tacklesForLoss: getStatNumber(stats, "tackles_for_loss"),
    sacks: getStatNumber(stats, "sacks"),
    qbHits: getStatNumber(stats, "qb_hits"),
    passBreakups: getStatNumber(stats, "pass_breakups"),
    defensiveInterceptions: mergeLegacyPair(stats, "defensive_interceptions", "interceptions"),
    forcedFumbles: getStatNumber(stats, "forced_fumbles"),
    fumbleRecoveries: getStatNumber(stats, "fumble_recoveries"),
    defensiveTouchdowns: getStatNumber(stats, "defensive_touchdowns"),
    safeties: getStatNumber(stats, "safeties"),
    fieldGoalsMade: getStatNumber(stats, "field_goals_made"),
    fieldGoalsAttempted: getStatNumber(stats, "field_goals_attempted"),
    fieldGoalLong: getStatNumber(stats, "field_goal_long"),
    extraPointsMade: getStatNumber(stats, "extra_points_made"),
    extraPointsAttempted: getStatNumber(stats, "extra_points_attempted"),
    punts: getStatNumber(stats, "punts"),
    puntYards: getStatNumber(stats, "punt_yards"),
    puntLong: getStatNumber(stats, "punt_long"),
    kickReturns: getStatNumber(stats, "kick_returns"),
    kickReturnYards: getStatNumber(stats, "kick_return_yards"),
    kickReturnTouchdowns: getStatNumber(stats, "kick_return_touchdowns"),
    puntReturns: getStatNumber(stats, "punt_returns"),
    puntReturnYards: getStatNumber(stats, "punt_return_yards"),
    puntReturnTouchdowns: getStatNumber(stats, "punt_return_touchdowns"),
  }
}

/** Table row: season view uses rowKey === player id; weekly view uses entry id as rowKey. */
export type StatsTableRow = PlayerStatsRow & {
  rowKey: string
  weekNumber?: number | null
  gameLabel?: string | null
  gameOpponent?: string | null
  gameDate?: string | null
}

export function playerToStatsTableRow(p: PlayerStatsRow): StatsTableRow {
  return { ...p, rowKey: p.id }
}

export type WeeklyStatEntryApi = {
  id: string
  playerId: string
  seasonYear: number | null
  weekNumber: number | null
  gameId: string | null
  opponent: string | null
  gameDate: string | null
  gameType?: string | null
  location?: string | null
  venue?: string | null
  result?: string | null
  teamScore?: number | null
  opponentScore?: number | null
  notes?: string | null
  stats: Record<string, unknown>
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  gameLabel: string | null
}

export function weeklyEntryToStatsTableRow(entry: WeeklyStatEntryApi): StatsTableRow {
  const base = toPlayerStatsRow({
    id: entry.playerId,
    firstName: entry.firstName,
    lastName: entry.lastName,
    jerseyNumber: entry.jerseyNumber,
    positionGroup: entry.positionGroup,
    seasonStats: entry.stats,
  })
  return {
    ...base,
    rowKey: entry.id,
    weekNumber: entry.weekNumber,
    gameOpponent: entry.opponent,
    gameDate: entry.gameDate,
    gameLabel: entry.gameLabel,
  }
}

/** Map season_stats JSON key → PlayerStatsRow field (for profile cards; values include legacy merges via toPlayerStatsRow). */
export const SEASON_STAT_KEY_TO_PLAYER_ROW_FIELD = {
  games_played: "gamesPlayed",
  pass_completions: "passCompletions",
  pass_attempts: "passAttempts",
  passing_yards: "passingYards",
  passing_touchdowns: "passingTouchdowns",
  int_thrown: "intThrown",
  pass_long: "passLong",
  sacks_taken: "sacksTaken",
  rush_attempts: "rushAttempts",
  rushing_yards: "rushingYards",
  rushing_touchdowns: "rushingTouchdowns",
  rush_long: "rushLong",
  receptions: "receptions",
  targets: "targets",
  receiving_yards: "receivingYards",
  receiving_touchdowns: "receivingTouchdowns",
  rec_long: "recLong",
  solo_tackles: "soloTackles",
  assisted_tackles: "assistedTackles",
  tackles_for_loss: "tacklesForLoss",
  sacks: "sacks",
  qb_hits: "qbHits",
  pass_breakups: "passBreakups",
  defensive_interceptions: "defensiveInterceptions",
  forced_fumbles: "forcedFumbles",
  fumble_recoveries: "fumbleRecoveries",
  defensive_touchdowns: "defensiveTouchdowns",
  safeties: "safeties",
  field_goals_made: "fieldGoalsMade",
  field_goals_attempted: "fieldGoalsAttempted",
  field_goal_long: "fieldGoalLong",
  extra_points_made: "extraPointsMade",
  extra_points_attempted: "extraPointsAttempted",
  punts: "punts",
  punt_yards: "puntYards",
  punt_long: "puntLong",
  kick_returns: "kickReturns",
  kick_return_yards: "kickReturnYards",
  kick_return_touchdowns: "kickReturnTouchdowns",
  punt_returns: "puntReturns",
  punt_return_yards: "puntReturnYards",
  punt_return_touchdowns: "puntReturnTouchdowns",
} as const satisfies Record<SeasonStatKey, keyof PlayerStatsRow>
