import type { BraikContext, QuestionDomain, QuestionIntent, DetectedEntities } from "./types"

export interface MergeInput {
  team: BraikContext["team"]
  domain: QuestionDomain
  intent: QuestionIntent
  relatedDomains: QuestionDomain[]
  entities: DetectedEntities
  players: import("./types").PlayerContext[] | null
  playbooks: BraikContext["playbooks"] | null
  formations: BraikContext["formations"] | null
  plays: BraikContext["plays"] | null
  injuries: import("./types").InjuryContext[] | null
  schedule: import("./types").ScheduleContext[] | null
  rosterSummary: BraikContext["rosterSummary"] | null
  reports: BraikContext["reports"] | null
  opponentTendencies?: import("./types").OpponentTendencyContext[] | null
}

/**
 * Merge module results into one BraikContext. Dedupe by id where applicable, add limitations when data missing.
 */
export function mergeContext(input: MergeInput): BraikContext {
  const limitations: string[] = []
  const playerIds = new Set<string>()
  const players = (input.players ?? []).filter((p) => {
    if (playerIds.has(p.id)) return false
    playerIds.add(p.id)
    return true
  })
  const playIds = new Set<string>()
  const plays = (input.plays ?? []).filter((p) => {
    if (playIds.has(p.id)) return false
    playIds.add(p.id)
    return true
  })
  const eventIds = new Set<string>()
  const schedule = (input.schedule ?? []).filter((s) => {
    if (eventIds.has(s.id)) return false
    eventIds.add(s.id)
    return true
  })

  if (input.players === null && (input.domain === "players" || input.relatedDomains.includes("players"))) {
    limitations.push("Player/roster data could not be loaded.")
  }
  if (input.playbooks === null && (input.domain === "playbooks" || input.relatedDomains.includes("playbooks"))) {
    limitations.push("Playbook data could not be loaded.")
  }
  if (input.injuries === null && (input.domain === "injuries" || input.relatedDomains.includes("injuries"))) {
    limitations.push("Injury report could not be loaded.")
  }
  if (input.schedule === null && (input.domain === "schedule" || input.relatedDomains.includes("schedule"))) {
    limitations.push("Schedule/events could not be loaded.")
  }
  if (input.rosterSummary === null && (input.domain === "roster" || input.relatedDomains.includes("roster"))) {
    limitations.push("Roster summary could not be loaded.")
  }
  if ((input.domain === "reports" || input.relatedDomains.includes("reports")) && (input.reports ?? []).length === 0) {
    limitations.push("No team or player documents found for this team.")
  }

  return {
    team: input.team,
    domain: input.domain,
    intent: input.intent,
    relatedDomains: input.relatedDomains,
    entities: input.entities,
    players,
    playbooks: input.playbooks ?? [],
    formations: input.formations ?? [],
    plays,
    injuries: input.injuries ?? [],
    schedule,
    rosterSummary: input.rosterSummary ?? null,
    reports: input.reports ?? [],
    opponentTendencies: input.opponentTendencies ?? [],
    limitations,
  }
}
