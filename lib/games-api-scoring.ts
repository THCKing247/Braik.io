import {
  hasAnyQuarterSet,
  parseQuarterInt,
  resultFromScores,
  teamOpponentTotalsFromQuarters,
  type GameQuarters,
} from "@/lib/games-quarter-scoring"

export const GAME_QUARTER_KEYS: (keyof GameQuarters)[] = [
  "q1_home",
  "q2_home",
  "q3_home",
  "q4_home",
  "q1_away",
  "q2_away",
  "q3_away",
  "q4_away",
]

const Q_KEYS = GAME_QUARTER_KEYS

export function patchBodyHasQuarterKeys(body: object): boolean {
  return GAME_QUARTER_KEYS.some((k) => Object.prototype.hasOwnProperty.call(body, k))
}

export type GamesDbRow = GameQuarters & {
  location: string | null
  team_score: number | null
  opponent_score: number | null
}

function parseScoreField(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "string" && v.trim() === "") return null
  if (typeof v === "number" && !Number.isNaN(v)) return Math.trunc(v)
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/**
 * JSON `null` for `teamScore` / `opponentScore` means **leave existing DB value** (no wipe).
 * Omitted keys also leave values unchanged.
 * Use `clearFinalScores: true` to intentionally clear totals, quarters, and computed merge result.
 *
 * Quarter keys: explicit `null` still clears that quarter cell (venue row).
 */
export function mergeGameScoringPatch(body: Record<string, unknown>, existing: GamesDbRow): Record<string, unknown> {
  if (body.clearFinalScores === true) {
    const out: Record<string, unknown> = {}
    for (const k of Q_KEYS) {
      out[k] = null
    }
    out.team_score = null
    out.opponent_score = null
    out.result = null
    return out
  }

  const wantsTeamScore =
    Object.prototype.hasOwnProperty.call(body, "teamScore") && body.teamScore !== null
  const wantsOppScore =
    Object.prototype.hasOwnProperty.call(body, "opponentScore") && body.opponentScore !== null

  /**
   * Coach entered both finals (e.g. modal sends score fields + quarter keys). Persist those finals and
   * clear venue quarters so old breakdown cannot overwrite the new totals in DB or on next fetch.
   */
  if (wantsTeamScore && wantsOppScore) {
    const out: Record<string, unknown> = {}
    for (const k of Q_KEYS) {
      out[k] = null
    }
    out.team_score = parseScoreField(body.teamScore)
    out.opponent_score = parseScoreField(body.opponentScore)
    const ts = out.team_score as number | null
    const os = out.opponent_score as number | null
    if (ts != null && os != null && Number.isFinite(ts) && Number.isFinite(os)) {
      out.result = resultFromScores(Math.trunc(ts), Math.trunc(os))
    }
    return out
  }

  const hasQk = patchBodyHasQuarterKeys(body)
  const hasScoreInputs = wantsTeamScore || wantsOppScore

  if (!hasQk && !hasScoreInputs) return {}

  const out: Record<string, unknown> = {}
  const nextQ: GameQuarters = {
    q1_home: existing.q1_home ?? null,
    q2_home: existing.q2_home ?? null,
    q3_home: existing.q3_home ?? null,
    q4_home: existing.q4_home ?? null,
    q1_away: existing.q1_away ?? null,
    q2_away: existing.q2_away ?? null,
    q3_away: existing.q3_away ?? null,
    q4_away: existing.q4_away ?? null,
  }

  if (hasQk) {
    for (const k of Q_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        nextQ[k] = parseQuarterInt(body[k])
      }
    }
    for (const k of Q_KEYS) {
      out[k] = nextQ[k]
    }
    if (hasAnyQuarterSet(nextQ)) {
      const { teamScore, opponentScore } = teamOpponentTotalsFromQuarters(existing.location, nextQ)
      out.team_score = teamScore
      out.opponent_score = opponentScore
    } else {
      if (wantsTeamScore) out.team_score = parseScoreField(body.teamScore)
      if (wantsOppScore) out.opponent_score = parseScoreField(body.opponentScore)
    }
  } else if (hasScoreInputs) {
    const fullTotalsReplace = wantsTeamScore && wantsOppScore
    if (fullTotalsReplace) {
      for (const k of Q_KEYS) {
        out[k] = null
      }
    }
    if (wantsTeamScore) out.team_score = parseScoreField(body.teamScore)
    if (wantsOppScore) out.opponent_score = parseScoreField(body.opponentScore)
  }

  const ts =
    out.team_score !== undefined ? (out.team_score as number | null) : existing.team_score
  const os =
    out.opponent_score !== undefined ? (out.opponent_score as number | null) : existing.opponent_score

  if (ts != null && os != null && Number.isFinite(ts) && Number.isFinite(os)) {
    out.result = resultFromScores(Math.trunc(ts), Math.trunc(os))
  }

  return out
}

/** Insert row scoring fields from POST body + location string. */
export function scoringFieldsForInsert(
  body: Record<string, unknown>,
  location: string | null
): Record<string, unknown> {
  const nextQ: GameQuarters = {
    q1_home: parseQuarterInt(body.q1_home),
    q2_home: parseQuarterInt(body.q2_home),
    q3_home: parseQuarterInt(body.q3_home),
    q4_home: parseQuarterInt(body.q4_home),
    q1_away: parseQuarterInt(body.q1_away),
    q2_away: parseQuarterInt(body.q2_away),
    q3_away: parseQuarterInt(body.q3_away),
    q4_away: parseQuarterInt(body.q4_away),
  }

  const row: Record<string, unknown> = {}
  for (const k of Q_KEYS) {
    row[k] = nextQ[k]
  }

  if (hasAnyQuarterSet(nextQ)) {
    const { teamScore, opponentScore } = teamOpponentTotalsFromQuarters(location, nextQ)
    row.team_score = teamScore
    row.opponent_score = opponentScore
  } else {
    row.team_score = parseScoreField(body.teamScore)
    row.opponent_score = parseScoreField(body.opponentScore)
  }

  const ts = row.team_score as number | null
  const os = row.opponent_score as number | null
  if (ts != null && os != null && Number.isFinite(ts) && Number.isFinite(os)) {
    row.result = resultFromScores(Math.trunc(ts), Math.trunc(os))
  }

  return row
}
