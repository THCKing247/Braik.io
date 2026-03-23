import { getStatNumber } from "@/lib/stats-helpers"

/** Tunable weights on canonical `season_stats`-style keys (snake_case). */
export type PotgWeights = Record<string, number>

export const DEFAULT_POTG_WEIGHTS: PotgWeights = {
  passing_touchdowns: 6,
  passing_yards: 0.04,
  rushing_touchdowns: 6,
  rushing_yards: 0.08,
  receiving_touchdowns: 6,
  receiving_yards: 0.06,
  receptions: 0.5,
  defensive_touchdowns: 8,
  defensive_interceptions: 5,
  sacks: 4,
  tackles_for_loss: 2,
  solo_tackles: 1.2,
  assisted_tackles: 0.6,
  forced_fumbles: 3,
  fumble_recoveries: 3,
  pass_breakups: 1.5,
  field_goals_made: 3,
  kick_return_touchdowns: 8,
  punt_return_touchdowns: 8,
  int_thrown: -4,
  safeties: 6,
}

export type GameStatsRowInput = {
  playerId: string
  firstName: string
  lastName: string
  positionGroup: string | null
  jerseyNumber: number | null
  stats: Record<string, unknown>
}

export type PlayerOfTheGameResult = {
  playerId: string
  firstName: string
  lastName: string
  positionGroup: string | null
  jerseyNumber: number | null
  score: number
  reasonParts: string[]
}

function tdTotal(stats: Record<string, unknown>): number {
  const pt =
    getStatNumber(stats, "passing_touchdowns") ?? getStatNumber(stats, "passing_tds") ?? 0
  const rt =
    getStatNumber(stats, "rushing_touchdowns") ?? getStatNumber(stats, "rushing_tds") ?? 0
  const ret =
    getStatNumber(stats, "receiving_touchdowns") ?? getStatNumber(stats, "receiving_tds") ?? 0
  const dt = getStatNumber(stats, "defensive_touchdowns") ?? 0
  const krt = getStatNumber(stats, "kick_return_touchdowns") ?? 0
  const prt = getStatNumber(stats, "punt_return_touchdowns") ?? 0
  return pt + rt + ret + dt + krt + prt
}

function yardTotal(stats: Record<string, unknown>): number {
  return (
    (getStatNumber(stats, "passing_yards") ?? 0) +
    (getStatNumber(stats, "rushing_yards") ?? 0) +
    (getStatNumber(stats, "receiving_yards") ?? 0)
  )
}

function buildReasonLines(stats: Record<string, unknown>): string[] {
  const lines: string[] = []
  const py = getStatNumber(stats, "passing_yards")
  const ptd =
    getStatNumber(stats, "passing_touchdowns") ?? getStatNumber(stats, "passing_tds")
  if (py != null && py > 0) lines.push(`${py} pass yds`)
  if (ptd != null && ptd > 0) lines.push(`${ptd} pass TD${ptd === 1 ? "" : "s"}`)
  const ry = getStatNumber(stats, "rushing_yards")
  const rtd =
    getStatNumber(stats, "rushing_touchdowns") ?? getStatNumber(stats, "rushing_tds")
  if (ry != null && ry > 0) lines.push(`${ry} rush yds`)
  if (rtd != null && rtd > 0) lines.push(`${rtd} rush TD${rtd === 1 ? "" : "s"}`)
  const recy = getStatNumber(stats, "receiving_yards")
  const rec = getStatNumber(stats, "receptions")
  const recTd =
    getStatNumber(stats, "receiving_touchdowns") ?? getStatNumber(stats, "receiving_tds")
  if (rec != null && rec > 0) lines.push(`${rec} rec`)
  if (recy != null && recy > 0) lines.push(`${recy} rec yds`)
  if (recTd != null && recTd > 0) lines.push(`${recTd} rec TD${recTd === 1 ? "" : "s"}`)
  const solo = getStatNumber(stats, "solo_tackles")
  const ast = getStatNumber(stats, "assisted_tackles")
  if (solo != null && solo > 0) lines.push(`${solo} solo`)
  if (ast != null && ast > 0) lines.push(`${ast} ast`)
  const sk = getStatNumber(stats, "sacks")
  if (sk != null && sk > 0) lines.push(`${sk} sack${sk === 1 ? "" : "s"}`)
  const di = getStatNumber(stats, "defensive_interceptions")
  if (di != null && di > 0) lines.push(`${di} INT`)
  const it = getStatNumber(stats, "int_thrown")
  if (it != null && it > 0) lines.push(`${it} INT thrown`)
  return lines.slice(0, 6)
}

/**
 * Weighted performance score + tie-breakers: total TDs, total yards, last name, first name, player id.
 */
export function computePlayerOfTheGame(
  rows: GameStatsRowInput[],
  weights: PotgWeights = DEFAULT_POTG_WEIGHTS
): PlayerOfTheGameResult | null {
  if (!rows.length) return null

  const scored = rows.map((r) => {
    const s = r.stats && typeof r.stats === "object" ? r.stats : {}
    let score = 0
    for (const [k, w] of Object.entries(weights)) {
      const v = getStatNumber(s, k)
      if (v != null && v !== 0 && w !== 0) score += v * w
    }
    const _td = tdTotal(s)
    const _yds = yardTotal(s)
    return {
      ...r,
      score,
      reasonParts: buildReasonLines(s),
      _td,
      _yds,
    }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b._td !== a._td) return b._td - a._td
    if (b._yds !== a._yds) return b._yds - a._yds
    const ln = a.lastName.localeCompare(b.lastName)
    if (ln !== 0) return ln
    const fn = a.firstName.localeCompare(b.firstName)
    if (fn !== 0) return fn
    return a.playerId.localeCompare(b.playerId)
  })

  const top = scored[0]
  if (top.score === 0 && top._td === 0 && top._yds === 0) {
    return null
  }

  return {
    playerId: top.playerId,
    firstName: top.firstName,
    lastName: top.lastName,
    positionGroup: top.positionGroup,
    jerseyNumber: top.jerseyNumber,
    score: Math.round(top.score * 100) / 100,
    reasonParts: top.reasonParts.length ? top.reasonParts : ["Top weighted game contribution"],
  }
}

export function formatPlayerOfTheGameLine(r: PlayerOfTheGameResult): string {
  const name = `${r.firstName} ${r.lastName}`.trim()
  const stats = r.reasonParts.join(", ")
  return stats ? `${name} — ${stats}` : name
}
