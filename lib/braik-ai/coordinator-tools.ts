import type { BraikContext } from "./types"

/**
 * Conceptual toolbox for Coach B. Wire the ones supported by current Braik data; stub the rest.
 * Used to structure recommendations and future features (e.g. game plan outline).
 */

export function analyzePlayerDecision(context: BraikContext): { supported: boolean; note: string } {
  const hasPlayers = context.players.length > 0
  const hasDepth = context.rosterSummary?.depthChartSummary?.length ?? 0 > 0
  const hasInjuries = context.injuries.length > 0
  return {
    supported: hasPlayers,
    note: hasPlayers ? "Use players, depth, availability, and coach notes from context." : "No player data in context.",
  }
}

export function comparePlayers(context: BraikContext): { supported: boolean; note: string } {
  return {
    supported: context.players.length >= 2,
    note: context.players.length >= 2 ? "Compare using stats, depth, availability, and notes." : "Need at least two players in context.",
  }
}

export function summarizeInjuries(context: BraikContext): { supported: boolean; note: string } {
  return {
    supported: true,
    note: context.injuries.length > 0 ? "Use injury report from context." : "No injury data in context.",
  }
}

export function summarizeSchedule(context: BraikContext): { supported: boolean; note: string } {
  return {
    supported: context.schedule.length >= 0,
    note: "Use schedule/events/games from context.",
  }
}

export function findPlaysByFormation(context: BraikContext): { supported: boolean; note: string } {
  return {
    supported: context.plays.length > 0,
    note: context.plays.length > 0 ? "Filter plays by formation/subformation and tags." : "No playbook data in context.",
  }
}

export function recommendPlaysForSituation(context: BraikContext): { supported: boolean; note: string } {
  return {
    supported: context.plays.length > 0 && context.entities.concepts.length > 0,
    note: context.plays.length > 0 ? "Match concepts (red zone, 3rd and medium, etc.) and formation from context." : "Need playbook and situation concepts.",
  }
}

export function summarizeRoster(context: BraikContext): { supported: boolean; note: string } {
  return {
    supported: context.rosterSummary !== null,
    note: context.rosterSummary ? "Use roster summary and depth from context." : "No roster data in context.",
  }
}

export function summarizeReport(context: BraikContext): { supported: boolean; note: string } {
  return {
    supported: context.reports.length > 0,
    note: context.reports.length > 0 ? "Summarize from report excerpts in context." : "No report data in context.",
  }
}

export function buildGamePlanOutline(_context: BraikContext): { supported: boolean; note: string } {
  return { supported: false, note: "Game plan outline not yet implemented; use schedule and playbook context for now." }
}

export function buildPracticePlanOutline(_context: BraikContext): { supported: boolean; note: string } {
  return { supported: false, note: "Practice plan outline not yet implemented; use schedule and roster context for now." }
}
