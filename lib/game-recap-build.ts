import type { TeamGameRow } from "@/lib/team-schedule-games"
import { effectiveTotalsFromGame, getQuartersFromGame, inferHomeAway } from "@/lib/team-schedule-games"
import type { TeamTrendsSnapshot } from "@/lib/schedule-team-trends"
import { computePlayerOfTheGame, type GameStatsRowInput } from "@/lib/schedule-player-of-game"

/** Serializable facts only — no opinions beyond what we pass. */
export type GameRecapFacts = {
  sport: "football"
  teamName: string
  opponent: string
  gameDate: string
  homeAway: "home" | "away" | "unknown"
  finalScore: { ours: number | null; theirs: number | null }
  quarterLines?: {
    venueHome: (number | null)[]
    venueAway: (number | null)[]
  }
  weekLabel?: string
  recordBeforeGame?: string
  teamTrends?: {
    seasonRecord: string
    streak: string
    lastThree: string
  }
  playerOfTheGame?: {
    name: string
    summary: string
  }
  statLeaders: { player: string; line: string }[]
}

export function buildGameRecapFacts(input: {
  teamName: string
  opponent: string
  game: TeamGameRow
  weekLabel?: string
  recordBeforeGame?: string
  trends?: TeamTrendsSnapshot | null
  playerRows: GameStatsRowInput[]
  potgOverride?: { firstName: string; lastName: string; reason?: string } | null
}): GameRecapFacts {
  const g = input.game
  const eff = effectiveTotalsFromGame(g)
  const ha = inferHomeAway(g.location)
  const q = getQuartersFromGame(g)
  const qh = [q.q1_home, q.q2_home, q.q3_home, q.q4_home]
  const qa = [q.q1_away, q.q2_away, q.q3_away, q.q4_away]
  const hasQ = qh.some((n) => n != null) || qa.some((n) => n != null)

  const auto = computePlayerOfTheGame(input.playerRows)
  const potg =
    input.potgOverride != null
      ? {
          name: `${input.potgOverride.firstName} ${input.potgOverride.lastName}`.trim(),
          summary: input.potgOverride.reason ?? "Coach-selected Player of the Game.",
        }
      : auto != null
        ? {
            name: `${auto.firstName} ${auto.lastName}`.trim(),
            summary: auto.reasonParts.join(", "),
          }
        : undefined

  const leaders = input.playerRows
    .map((r) => {
      const autoOne = computePlayerOfTheGame([r])
      if (!autoOne || autoOne.score <= 0) return null
      return { player: `${r.firstName} ${r.lastName}`.trim(), line: autoOne.reasonParts.join(", ") }
    })
    .filter((x): x is { player: string; line: string } => x != null)
    .slice(0, 4)

  return {
    sport: "football",
    teamName: input.teamName,
    opponent: input.opponent?.trim() || "Opponent",
    gameDate: g.gameDate,
    homeAway: ha === "home" ? "home" : ha === "away" ? "away" : "unknown",
    finalScore: { ours: eff.team, theirs: eff.opponent },
    quarterLines: hasQ ? { venueHome: qh, venueAway: qa } : undefined,
    weekLabel: input.weekLabel,
    recordBeforeGame: input.recordBeforeGame,
    teamTrends: input.trends
      ? {
          seasonRecord: input.trends.recordLabel,
          streak: input.trends.streakLabel,
          lastThree: input.trends.lastThreeSummary,
        }
      : undefined,
    playerOfTheGame: potg,
    statLeaders: leaders,
  }
}

export const GAME_RECAP_SYSTEM_INSTRUCTIONS = `You write short high-school football game recaps for coaches and families.
Rules:
- Use ONLY facts present in the JSON payload. Do not invent injuries, weather, crowd, or plays not implied by the data.
- If information is missing, omit it rather than guessing.
- Write 1–3 tight paragraphs (under 220 words total), professional and upbeat.
- Mention the final score, winner, and week label if provided.
- If quarter scores exist, you may describe momentum briefly using those numbers only.
- If player of the game or stat leaders are listed, highlight them briefly.
- If data is very thin, write one paragraph summarizing the final and record context only.`

export function gameRecapUserContent(facts: GameRecapFacts): string {
  return `Facts JSON (authoritative):\n${JSON.stringify(facts, null, 2)}`
}

/** Alias for callers that refer to “recap input” naming. */
export const buildGameRecapInput = buildGameRecapFacts
