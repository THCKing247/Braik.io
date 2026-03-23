import { inferHomeAway } from "@/lib/team-schedule-games"

export type GameQuarters = {
  q1_home: number | null
  q2_home: number | null
  q3_home: number | null
  q4_home: number | null
  q1_away: number | null
  q2_away: number | null
  q3_away: number | null
  q4_away: number | null
}

export function sumQuarterList(q: Array<number | null | undefined>): number {
  let t = 0
  for (const n of q) {
    if (n == null || !Number.isFinite(Number(n))) continue
    t += Math.trunc(Number(n))
  }
  return t
}

export function venueTotalsFromQuarters(q: GameQuarters): { home: number; away: number } {
  const home = sumQuarterList([q.q1_home, q.q2_home, q.q3_home, q.q4_home])
  const away = sumQuarterList([q.q1_away, q.q2_away, q.q3_away, q.q4_away])
  return { home, away }
}

/** Map venue quarters to Braik team / opponent scores using `location` home-away hint. */
export function teamOpponentTotalsFromQuarters(
  location: string | null,
  q: GameQuarters
): { teamScore: number; opponentScore: number } {
  const { home, away } = venueTotalsFromQuarters(q)
  const ha = inferHomeAway(location)
  if (ha === "away") return { teamScore: away, opponentScore: home }
  return { teamScore: home, opponentScore: away }
}

export function hasAnyQuarterSet(q: Partial<GameQuarters> | null | undefined): boolean {
  if (!q) return false
  const keys: (keyof GameQuarters)[] = [
    "q1_home",
    "q2_home",
    "q3_home",
    "q4_home",
    "q1_away",
    "q2_away",
    "q3_away",
    "q4_away",
  ]
  for (const k of keys) {
    const v = q[k]
    if (v != null && Number.isFinite(Number(v))) return true
  }
  return false
}

export function parseQuarterInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export function resultFromScores(teamScore: number, opponentScore: number): "win" | "loss" | "tie" {
  if (teamScore > opponentScore) return "win"
  if (teamScore < opponentScore) return "loss"
  return "tie"
}
