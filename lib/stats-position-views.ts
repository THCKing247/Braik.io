/**
 * Position-aware stat presets for dashboard table columns and profile summaries.
 * Uses canonical SeasonStatKey values; maps to PlayerStatsRow fields via SEASON_STAT_KEY_TO_PLAYER_ROW_FIELD.
 */
import type { PlayerStatsRow } from "@/lib/stats-helpers"
import { SEASON_STAT_KEY_TO_PLAYER_ROW_FIELD } from "@/lib/stats-helpers"
import type { SeasonStatKey } from "@/lib/stats-schema"
import * as derived from "@/lib/stats-derived"

export type PositionViewGroupId =
  | "QB"
  | "RB"
  | "WR_TE"
  | "OL"
  | "DL_LB_DB"
  | "K_P"
  | "RETURNER_ATH"
  | "GENERAL"

/** Ordered ids for priority when resolving multi-token positions. */
export const POSITION_VIEW_GROUPS: readonly PositionViewGroupId[] = [
  "QB",
  "RB",
  "WR_TE",
  "OL",
  "DL_LB_DB",
  "K_P",
  "RETURNER_ATH",
  "GENERAL",
] as const

/** Lower index = wins when multiple position tokens map to different groups. */
const GROUP_PRIORITY: readonly PositionViewGroupId[] = POSITION_VIEW_GROUPS

const PRIMARY_SEASON_KEYS: Record<PositionViewGroupId, readonly SeasonStatKey[]> = {
  QB: [
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
  ],
  RB: [
    "games_played",
    "rush_attempts",
    "rushing_yards",
    "rushing_touchdowns",
    "rush_long",
    "receptions",
    "targets",
    "receiving_yards",
    "receiving_touchdowns",
    "rec_long",
  ],
  WR_TE: [
    "games_played",
    "receptions",
    "targets",
    "receiving_yards",
    "receiving_touchdowns",
    "rec_long",
    "rush_attempts",
    "rushing_yards",
    "rushing_touchdowns",
  ],
  OL: ["games_played"],
  DL_LB_DB: [
    "games_played",
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
  K_P: [
    "games_played",
    "field_goals_made",
    "field_goals_attempted",
    "field_goal_long",
    "extra_points_made",
    "extra_points_attempted",
    "punts",
    "punt_yards",
    "punt_long",
  ],
  RETURNER_ATH: [
    "games_played",
    "kick_returns",
    "kick_return_yards",
    "kick_return_touchdowns",
    "punt_returns",
    "punt_return_yards",
    "punt_return_touchdowns",
    "rush_attempts",
    "rushing_yards",
    "receptions",
    "receiving_yards",
  ],
  GENERAL: [
    "games_played",
    "pass_completions",
    "pass_attempts",
    "passing_yards",
    "passing_touchdowns",
    "int_thrown",
    "rush_attempts",
    "rushing_yards",
    "rushing_touchdowns",
    "receptions",
    "receiving_yards",
    "receiving_touchdowns",
    "solo_tackles",
    "assisted_tackles",
    "tackles_for_loss",
    "sacks",
    "defensive_interceptions",
    "field_goals_made",
    "field_goals_attempted",
    "punts",
  ],
}

export function getPrimarySeasonStatKeysForGroup(group: PositionViewGroupId): SeasonStatKey[] {
  return [...PRIMARY_SEASON_KEYS[group]]
}

export function getPrimaryStatKeysForPosition(position: string | null | undefined): SeasonStatKey[] {
  const { group } = getStatsViewForPosition(position)
  return getPrimarySeasonStatKeysForGroup(group)
}

/** Table columns: identity + stats (gamesPlayed first among stats). */
export function getPrimaryPlayerRowStatKeysForGroup(group: PositionViewGroupId): (keyof PlayerStatsRow)[] {
  const identity: (keyof PlayerStatsRow)[] = ["lastName", "jerseyNumber", "position"]
  const fromSeason = getPrimarySeasonStatKeysForGroup(group).map((k) => SEASON_STAT_KEY_TO_PLAYER_ROW_FIELD[k])
  const merged = [...identity, ...fromSeason]
  return [...new Set(merged)]
}

export function tokenToPositionGroup(token: string): PositionViewGroupId | null {
  const t = token.toUpperCase().replace(/\./g, "").trim()
  if (!t) return null
  if (["QB", "QUARTERBACK"].includes(t)) return "QB"
  if (["RB", "FB", "HB"].includes(t)) return "RB"
  if (["WR", "TE", "SE", "FL"].includes(t)) return "WR_TE"
  if (["OL", "OT", "OG", "C", "OC", "OG/OT", "T", "G"].includes(t)) return "OL"
  if (["DE", "DT", "NT", "DL", "EDGE"].includes(t)) return "DL_LB_DB"
  if (["LB", "ILB", "OLB", "MLB", "SAM", "MIKE", "WILL", "NB"].includes(t)) return "DL_LB_DB"
  if (["CB", "DB", "S", "FS", "SS", "STAR", "NICKEL"].includes(t)) return "DL_LB_DB"
  if (["K", "PK", "KICKER", "KOS"].includes(t)) return "K_P"
  if (["P", "PUNTER"].includes(t)) return "K_P"
  if (["KR", "PR", "KOR", "RS", "RET"].includes(t)) return "RETURNER_ATH"
  if (["ATH", "ATHLETE"].includes(t)) return "RETURNER_ATH"
  return null
}

/** Split combined roster strings: "QB/DB", "WR, CB", "RB / LB" */
export function normalizeFootballPositionTokens(raw: string | null | undefined): string[] {
  if (raw == null || typeof raw !== "string") return []
  return raw
    .split(/[/|,]+/)
    .flatMap((part) => part.split(/\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Normalized display token string (e.g. "QB / DB") for UI; empty if missing. */
export function normalizeFootballPosition(position: string | null | undefined): string {
  const t = normalizeFootballPositionTokens(position)
  return t.length ? t.join(" / ") : ""
}

export function getStatsViewGroupFromTokens(tokens: string[]): PositionViewGroupId {
  const groups: PositionViewGroupId[] = []
  for (const tok of tokens) {
    const g = tokenToPositionGroup(tok)
    if (g) groups.push(g)
  }
  if (groups.length === 0) return "GENERAL"
  let best: PositionViewGroupId = groups[0]
  let bestIdx = GROUP_PRIORITY.indexOf(best)
  for (let i = 1; i < groups.length; i++) {
    const idx = GROUP_PRIORITY.indexOf(groups[i])
    if (idx >= 0 && idx < bestIdx) {
      bestIdx = idx
      best = groups[i]
    }
  }
  return best
}

export function getStatsViewForPosition(position: string | null | undefined): {
  group: PositionViewGroupId
  tokens: string[]
} {
  const tokens = normalizeFootballPositionTokens(position ?? "")
  return { group: getStatsViewGroupFromTokens(tokens), tokens }
}

export type DerivedCardSpec = {
  id: string
  shortLabel: string
  format: (n: number) => string
  value: (r: PlayerStatsRow) => number | null
  /** Omit card when false */
  isRelevant?: (r: PlayerStatsRow) => boolean
}

function fmtPct(n: number): string {
  return `${n % 1 === 0 ? String(n) : n.toFixed(1)}%`
}

function fmtNum(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

const DERIVED_BY_GROUP: Record<PositionViewGroupId, DerivedCardSpec[]> = {
  QB: [
    {
      id: "completionPct",
      shortLabel: "Comp %",
      format: fmtPct,
      value: (r) => derived.completionPct(r.passCompletions, r.passAttempts),
      isRelevant: (r) => (r.passAttempts ?? 0) > 0,
    },
    {
      id: "yardsPerAttempt",
      shortLabel: "Yds/Att",
      format: fmtNum,
      value: (r) => derived.yardsPerAttempt(r.passingYards, r.passAttempts),
      isRelevant: (r) => (r.passAttempts ?? 0) > 0,
    },
    {
      id: "yardsPerCarry",
      shortLabel: "Yds/Car",
      format: fmtNum,
      value: (r) => derived.yardsPerCarry(r.rushingYards, r.rushAttempts),
      isRelevant: (r) => (r.rushAttempts ?? 0) > 0,
    },
  ],
  RB: [
    {
      id: "yardsPerCarry",
      shortLabel: "Yds/Car",
      format: fmtNum,
      value: (r) => derived.yardsPerCarry(r.rushingYards, r.rushAttempts),
      isRelevant: (r) => (r.rushAttempts ?? 0) > 0,
    },
    {
      id: "yardsPerReception",
      shortLabel: "Yds/Rec",
      format: fmtNum,
      value: (r) => derived.yardsPerReception(r.receivingYards, r.receptions),
      isRelevant: (r) => (r.receptions ?? 0) > 0,
    },
    {
      id: "catchPct",
      shortLabel: "Catch %",
      format: fmtPct,
      value: (r) => derived.catchPct(r.receptions, r.targets),
      isRelevant: (r) => (r.targets ?? 0) > 0,
    },
  ],
  WR_TE: [
    {
      id: "catchPct",
      shortLabel: "Catch %",
      format: fmtPct,
      value: (r) => derived.catchPct(r.receptions, r.targets),
      isRelevant: (r) => (r.targets ?? 0) > 0,
    },
    {
      id: "yardsPerReception",
      shortLabel: "Yds/Rec",
      format: fmtNum,
      value: (r) => derived.yardsPerReception(r.receivingYards, r.receptions),
      isRelevant: (r) => (r.receptions ?? 0) > 0,
    },
    {
      id: "yardsPerCarry",
      shortLabel: "Yds/Car",
      format: fmtNum,
      value: (r) => derived.yardsPerCarry(r.rushingYards, r.rushAttempts),
      isRelevant: (r) => (r.rushAttempts ?? 0) > 0,
    },
  ],
  OL: [],
  DL_LB_DB: [
    {
      id: "totalTackles",
      shortLabel: "Tackles",
      format: (n) => String(Math.round(n)),
      value: (r) => derived.totalTackles(r.soloTackles, r.assistedTackles),
      isRelevant: (r) =>
        (r.soloTackles != null && r.soloTackles > 0) ||
        (r.assistedTackles != null && r.assistedTackles > 0),
    },
  ],
  K_P: [
    {
      id: "fgPct",
      shortLabel: "FG %",
      format: fmtPct,
      value: (r) => derived.fgPct(r.fieldGoalsMade, r.fieldGoalsAttempted),
      isRelevant: (r) => (r.fieldGoalsAttempted ?? 0) > 0,
    },
    {
      id: "xpPct",
      shortLabel: "XP %",
      format: fmtPct,
      value: (r) => derived.xpPct(r.extraPointsMade, r.extraPointsAttempted),
      isRelevant: (r) => (r.extraPointsAttempted ?? 0) > 0,
    },
    {
      id: "avgPuntYards",
      shortLabel: "Punt avg",
      format: fmtNum,
      value: (r) => derived.avgPuntYards(r.puntYards, r.punts),
      isRelevant: (r) => (r.punts ?? 0) > 0,
    },
  ],
  RETURNER_ATH: [
    {
      id: "kickReturnAvg",
      shortLabel: "KR avg",
      format: fmtNum,
      value: (r) => derived.kickReturnAvg(r.kickReturnYards, r.kickReturns),
      isRelevant: (r) => (r.kickReturns ?? 0) > 0,
    },
    {
      id: "puntReturnAvg",
      shortLabel: "PR avg",
      format: fmtNum,
      value: (r) => derived.puntReturnAvg(r.puntReturnYards, r.puntReturns),
      isRelevant: (r) => (r.puntReturns ?? 0) > 0,
    },
    {
      id: "yardsPerCarry",
      shortLabel: "Yds/Car",
      format: fmtNum,
      value: (r) => derived.yardsPerCarry(r.rushingYards, r.rushAttempts),
      isRelevant: (r) => (r.rushAttempts ?? 0) > 0,
    },
    {
      id: "yardsPerReception",
      shortLabel: "Yds/Rec",
      format: fmtNum,
      value: (r) => derived.yardsPerReception(r.receivingYards, r.receptions),
      isRelevant: (r) => (r.receptions ?? 0) > 0,
    },
  ],
  GENERAL: [
    {
      id: "completionPct",
      shortLabel: "Comp %",
      format: fmtPct,
      value: (r) => derived.completionPct(r.passCompletions, r.passAttempts),
      isRelevant: (r) => (r.passAttempts ?? 0) > 0,
    },
    {
      id: "yardsPerCarry",
      shortLabel: "Yds/Car",
      format: fmtNum,
      value: (r) => derived.yardsPerCarry(r.rushingYards, r.rushAttempts),
      isRelevant: (r) => (r.rushAttempts ?? 0) > 0,
    },
    {
      id: "totalTackles",
      shortLabel: "Tackles",
      format: (n) => String(Math.round(n)),
      value: (r) => derived.totalTackles(r.soloTackles, r.assistedTackles),
      isRelevant: (r) =>
        (r.soloTackles != null && r.soloTackles > 0) ||
        (r.assistedTackles != null && r.assistedTackles > 0),
    },
  ],
}

export function getDerivedCardSpecsForGroup(group: PositionViewGroupId): DerivedCardSpec[] {
  return DERIVED_BY_GROUP[group] ?? []
}

/** Alias for consumers expecting the spec name from the product brief. */
export const getDerivedCardsForPositionGroup = getDerivedCardSpecsForGroup

export function buildVisibleDerivedCards(row: PlayerStatsRow, group: PositionViewGroupId): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const spec of getDerivedCardSpecsForGroup(group)) {
    if (spec.isRelevant && !spec.isRelevant(row)) continue
    const n = spec.value(row)
    if (n === null || n === undefined) continue
    out.push({ label: spec.shortLabel, value: spec.format(n) })
  }
  return out
}

/** Overview season tab: only show these canonical keys (subset of full schema). */
export function shouldShowSeasonKeyInOverview(group: PositionViewGroupId, key: SeasonStatKey): boolean {
  const set = new Set(PRIMARY_SEASON_KEYS[group])
  return set.has(key)
}
