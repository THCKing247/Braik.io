/**
 * Shared types and helpers for team All Stats page.
 * Reads from players.season_stats (JSONB) and players profile fields.
 */

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

/** Numeric stat keys we display; matches player-profile-stats-form + extended. */
export const SEASON_STAT_KEYS = [
  "games_played",
  "passing_yards",
  "passing_tds",
  "int_thrown",
  "rushing_yards",
  "rushing_tds",
  "receptions",
  "receiving_yards",
  "receiving_tds",
  "touchdowns",
  "tackles",
  "sacks",
  "interceptions",
] as const

export type SeasonStatKey = (typeof SEASON_STAT_KEYS)[number]

/** Extract numeric value from season_stats (flat keys). Handles nested e.g. passing.yards if needed. */
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

/** One row for the All Stats table (profile + aggregated stats). */
export interface PlayerStatsRow {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  position: string | null
  sideOfBall: SideOfBall
  gamesPlayed: number | null
  passingYards: number | null
  passingTds: number | null
  intThrown: number | null
  rushingYards: number | null
  rushingTds: number | null
  receptions: number | null
  receivingYards: number | null
  receivingTds: number | null
  tackles: number | null
  sacks: number | null
  interceptions: number | null
}

/** Build a PlayerStatsRow from API player + season_stats. */
export function toPlayerStatsRow(p: {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  seasonStats?: Record<string, unknown> | null
}): PlayerStatsRow {
  const stats = p.seasonStats && typeof p.seasonStats === "object" ? p.seasonStats : {}
  const num = (k: string) => getStatNumber(stats, k)
  // Support alternate keys (e.g. touchdowns -> passing_tds if no passing_tds)
  const gp = num("games_played")
  const passYds = num("passing_yards")
  const passTds = num("passing_tds")
  const intThrown = num("int_thrown")
  const rushYds = num("rushing_yards")
  const rushTds = num("rushing_tds")
  const rec = num("receptions")
  const recYds = num("receiving_yards")
  const recTds = num("receiving_tds")
  const tackles = num("tackles")
  const sacks = num("sacks")
  const ints = num("interceptions")

  return {
    id: p.id,
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    jerseyNumber: p.jerseyNumber ?? null,
    position: p.positionGroup ?? null,
    sideOfBall: getPositionSide(p.positionGroup ?? null),
    gamesPlayed: gp,
    passingYards: passYds,
    passingTds: passTds,
    intThrown,
    rushingYards: rushYds,
    rushingTds: rushTds,
    receptions: rec,
    receivingYards: recYds,
    receivingTds: recTds,
    tackles,
    sacks,
    interceptions: ints,
  }
}

/** Table row: season view uses rowKey === player id; weekly view uses entry id as rowKey. */
export type StatsTableRow = PlayerStatsRow & {
  rowKey: string
  weekNumber?: number | null
  gameLabel?: string | null
  /** Row-level opponent label (weekly / game context). */
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
