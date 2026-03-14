/**
 * Coordinator tools: real reasoning over BraikContext (no fetch).
 * Run: npx tsx tests/braik-ai-coordinator-tools.test.ts
 */
import {
  analyzePlayerDecision,
  comparePlayers,
  summarizeInjuries,
  summarizeSchedule,
  findPlaysByFormation,
  recommendPlaysForSituation,
  summarizeReport,
  runCoordinatorTool,
} from "../lib/braik-ai/coordinator-tools"
import type { BraikContext } from "../lib/braik-ai/types"
import { EMPTY_ENTITIES } from "../lib/braik-ai/shared"

function emptyCtx(overrides: Partial<BraikContext> = {}): BraikContext {
  return {
    team: { id: "t1", name: "Test Team" },
    domain: "generic",
    intent: "generic",
    relatedDomains: [],
    entities: { ...EMPTY_ENTITIES },
    players: [],
    playbooks: [],
    formations: [],
    plays: [],
    injuries: [],
    schedule: [],
    rosterSummary: null,
    reports: [],
    opponentTendencies: [],
    limitations: [],
    ...overrides,
  }
}

const basePlayer = {
  id: "p1",
  fullName: "Mason Hall",
  jerseyNumber: 12,
  primaryPosition: "QB",
  secondaryPositions: null,
  classYear: null,
  height: null,
  weight: null,
  starter: true,
  depthChartOrder: "1",
  availability: "available",
  injuryStatus: null,
  profileSummary: null,
  coachNotes: null,
  stats: { passing: {}, rushing: {}, receiving: {}, defense: {}, kicking: {}, specialTeams: {} },
}

console.log("--- analyzePlayerDecision ---")
const ctxPlayers = emptyCtx({
  domain: "players",
  intent: "player_decision",
  players: [
    { ...basePlayer, id: "p1", fullName: "Mason Hall", jerseyNumber: 12, primaryPosition: "QB", depthChartOrder: "1", starter: true },
    { ...basePlayer, id: "p2", fullName: "Tyler Nelson", jerseyNumber: 8, primaryPosition: "QB", depthChartOrder: "2", starter: false },
  ],
  entities: { ...EMPTY_ENTITIES, positions: ["QB"] },
})
const decision = analyzePlayerDecision(ctxPlayers, "Which QB should I start?")
console.log(decision.summary.includes("Mason") || decision.summary.includes("Tyler") ? "ok: player decision summary" : "fail")
console.log(Array.isArray(decision.limitations) ? "ok: limitations array" : "fail")

console.log("\n--- comparePlayers ---")
const compare = comparePlayers(ctxPlayers, "Compare Mason Hall and Tyler Nelson")
console.log(compare.summary.includes("Mason") || compare.summary.includes("Tyler") ? "ok: compare summary" : "fail")

console.log("\n--- summarizeInjuries ---")
const ctxInjuries = emptyCtx({
  domain: "injuries",
  intent: "injury_summary",
  injuries: [
    { playerId: "p1", fullName: "Mason Hall", status: "questionable", availability: "limited", practiceStatus: null, bodyPart: null, notes: null, expectedReturn: "2024-10-01", reason: "ankle" },
    { playerId: "p2", fullName: "Tyler Nelson", status: "out", availability: "out", practiceStatus: null, bodyPart: null, notes: null, expectedReturn: null, reason: "concussion" },
  ],
})
const injSummary = summarizeInjuries(ctxInjuries, "Who is on the injury report?")
console.log(injSummary.summary.includes("injury") || injSummary.summary.includes("2") ? "ok: injury summary" : "fail")
console.log(injSummary.details && injSummary.details.length > 0 ? "ok: injury details" : "fail")

console.log("\n--- summarizeSchedule ---")
const ctxSchedule = emptyCtx({
  domain: "schedule",
  intent: "schedule_summary",
  schedule: [
    { id: "e1", title: "Game", type: "game", start: "2024-09-15T19:00:00", end: null, opponent: "Central", location: "Home", notes: null },
    { id: "e2", title: "Practice", type: "practice", start: "2024-09-10T15:00:00", end: null, opponent: null, location: null, notes: null },
  ],
})
const schedSummary = summarizeSchedule(ctxSchedule, "Who do we play next?")
console.log(schedSummary.summary.includes("Central") || schedSummary.summary.includes("Next game") ? "ok: schedule summary" : "fail")

console.log("\n--- findPlaysByFormation ---")
const ctxPlays = emptyCtx({
  domain: "playbooks",
  intent: "play_lookup",
  formations: [{ id: "f1", name: "Trips Right", side: "offense", playbookId: "pb1", subFormationCount: 0, playCount: 3 }],
  plays: [
    { id: "pl1", name: "Flood", formation: "Trips Right", subformation: null, tags: ["red zone"], concept: "Flood", playType: null, notes: null, situation: "red zone", motion: null, assignmentsSummary: null },
    { id: "pl2", name: "Mesh", formation: "Trips Right", subformation: null, tags: [], concept: "Mesh", playType: null, notes: null, situation: null, motion: "jet", assignmentsSummary: null },
  ],
  entities: { ...EMPTY_ENTITIES, formationNames: ["Trips Right"] },
})
const playsFound = findPlaysByFormation(ctxPlays, "Show me my Trips Right plays")
console.log(playsFound.summary.includes("Trips") && playsFound.summary.includes("2") ? "ok: find plays" : "fail")

console.log("\n--- recommendPlaysForSituation ---")
const recPlays = recommendPlaysForSituation(ctxPlays, "What are my best red zone plays from Trips Right?")
console.log(recPlays.summary.includes("Flood") || recPlays.summary.includes("play") ? "ok: recommend plays" : "fail")

console.log("\n--- summarizeReport ---")
const ctxReports = emptyCtx({
  domain: "reports",
  intent: "report_summary",
  reports: [
    { id: "r1", source: "Team document", excerpt: "Practice plan: Monday 3pm full pads. Tuesday 2pm shells.", type: "practice_plan", hasExtractedText: true },
  ],
})
const reportSummary = summarizeReport(ctxReports, "Summarize the practice plan")
console.log(reportSummary.summary.includes("extracted") || reportSummary.summary.includes("document") ? "ok: report summary" : "fail")

const ctxReportsMetaOnly = emptyCtx({
  domain: "reports",
  reports: [{ source: "Team document", excerpt: "Practice Plan (practice_plan)", type: "practice_plan", hasExtractedText: false }],
})
const reportMeta = summarizeReport(ctxReportsMetaOnly, "Summarize the practice plan")
console.log(reportMeta.limitations.length > 0 || reportMeta.summary.toLowerCase().includes("no extracted") ? "ok: metadata-only limitation" : "fail")

console.log("\n--- runCoordinatorTool dispatcher ---")
const analysis1 = runCoordinatorTool(ctxPlayers, "Which QB should I start?")
console.log(analysis1?.tool === "analyzePlayerDecision" ? "ok: dispatcher player_decision" : "fail")

const analysis2 = runCoordinatorTool(ctxInjuries, "Who is on the injury report?")
console.log(analysis2?.tool === "summarizeInjuries" ? "ok: dispatcher injury_summary" : "fail")

const ctxPlayRec = emptyCtx({
  ...ctxPlays,
  intent: "play_recommendation",
  entities: { ...EMPTY_ENTITIES, formationNames: ["Trips Right"], concepts: ["red zone"] },
})
const analysis3 = runCoordinatorTool(ctxPlayRec, "What are my best red zone plays?")
console.log(analysis3?.tool === "recommendPlaysForSituation" ? "ok: dispatcher play_recommendation" : "fail")

const analysis4 = runCoordinatorTool(ctxReports, "Summarize the practice plan")
console.log(analysis4?.tool === "summarizeReport" ? "ok: dispatcher report_summary" : "fail")

const analysis5 = runCoordinatorTool(emptyCtx(), "What's the weather?")
console.log(analysis5 === null ? "ok: generic returns null" : "fail")

console.log("\n--- Polish: player decision with missing stats ---")
const decisionNoStats = analyzePlayerDecision(ctxPlayers, "Which QB should I start?")
console.log(decisionNoStats.limitations.some((l) => l.includes("stats") || l.includes("depth")) ? "ok: limitations mention stats/depth" : "fail")
console.log((decisionNoStats.confidence === "medium" || decisionNoStats.confidence === "low") ? "ok: confidence not high when no stats" : "fail")

console.log("\n--- Polish: report summary metadata only ---")
const reportMetaOnly = summarizeReport(ctxReportsMetaOnly, "Summarize the practice plan")
console.log(reportMetaOnly.confidence === "low" ? "ok: metadata-only has low confidence" : "fail")
console.log(reportMetaOnly.limitations.some((l) => l.includes("metadata") || l.includes("extracted") || l.includes("titles")) ? "ok: metadata-only limitation" : "fail")

console.log("\n--- Polish: play recommendation without situation tags ---")
const playsNoSituation = emptyCtx({
  domain: "playbooks",
  intent: "play_recommendation",
  formations: [{ id: "f1", name: "Trips Right", side: "offense", playbookId: "pb1", subFormationCount: 0, playCount: 2 }],
  plays: [
    { id: "pl1", name: "Flood", formation: "Trips Right", subformation: null, tags: [], concept: "Flood", playType: null, notes: null, situation: null, motion: null, assignmentsSummary: null },
    { id: "pl2", name: "Mesh", formation: "Trips Right", subformation: null, tags: [], concept: "Mesh", playType: null, notes: null, situation: null, motion: null, assignmentsSummary: null },
  ],
  entities: { ...EMPTY_ENTITIES, formationNames: ["Trips Right"], concepts: ["red zone"] },
})
const recNoTags = recommendPlaysForSituation(playsNoSituation, "What are my best red zone plays?")
console.log(recNoTags.limitations.some((l) => l.includes("situation") || l.includes("tags")) ? "ok: no situation tags limitation" : "fail")
console.log(recNoTags.confidence === "medium" ? "ok: medium confidence when no situation tags" : "fail")

console.log("\n--- Polish: injury summary with starter impact ---")
const ctxInjuriesWithStarters = emptyCtx({
  domain: "injuries",
  intent: "injury_summary",
  players: [{ ...basePlayer, id: "p1", fullName: "Mason Hall", starter: true }],
  injuries: [
    { playerId: "p1", fullName: "Mason Hall", status: "questionable", availability: "limited", practiceStatus: null, bodyPart: "ankle", notes: null, expectedReturn: "2024-10-01", reason: "ankle" },
  ],
})
const injWithStarters = summarizeInjuries(ctxInjuriesWithStarters, "Which starters are questionable?")
console.log(injWithStarters.details?.some((d) => d.toLowerCase().includes("starter")) ? "ok: starter impact in details" : "fail")
console.log(injWithStarters.confidence === "high" ? "ok: high confidence when starters impacted" : "fail")

console.log("\n--- Polish: dispatcher null for generic chat ---")
console.log(runCoordinatorTool(emptyCtx(), "What's the weather?") === null ? "ok: null for generic" : "fail")
console.log(runCoordinatorTool(emptyCtx(), "Tell me a joke") === null ? "ok: null for off-topic" : "fail")

console.log("\n--- Explainability: close player ranking ---")
const ctxCloseRank = emptyCtx({
  domain: "players",
  intent: "player_decision",
  entities: { ...EMPTY_ENTITIES, positions: ["QB"] },
  players: [
    { ...basePlayer, id: "p1", fullName: "Mason Hall", jerseyNumber: 12, primaryPosition: "QB", depthChartOrder: "2", starter: false, availability: "available" },
    { ...basePlayer, id: "p2", fullName: "Tyler Nelson", jerseyNumber: 8, primaryPosition: "QB", depthChartOrder: "2", starter: false, availability: "available" },
  ],
})
const closeDecision = analyzePlayerDecision(ctxCloseRank, "Which QB should get more reps?")
const hasClosePhrasing = /close|gets the edge|edge because/i.test(closeDecision.summary)
console.log(hasClosePhrasing || closeDecision.summary.includes("Mason") ? "ok: close ranking or names present" : "fail")
console.log(closeDecision.summary.includes("Top factors") || closeDecision.basedOn ? "ok: top factors or basedOn" : "fail")

console.log("\n--- Explainability: split comparison (who wins where) ---")
const ctxSplit = emptyCtx({
  domain: "players",
  intent: "player_comparison",
  entities: { ...EMPTY_ENTITIES, namedPlayers: ["Mason", "Tyler"] },
  players: [
    { ...basePlayer, id: "p1", fullName: "Mason Hall", primaryPosition: "QB", depthChartOrder: "2", starter: false, stats: { passing: { yards: 1200, tds: 10 }, rushing: {}, receiving: {}, defense: {}, kicking: {}, specialTeams: {} } },
    { ...basePlayer, id: "p2", fullName: "Tyler Nelson", primaryPosition: "QB", depthChartOrder: "1", starter: true, availability: "available", injuryStatus: null, stats: { passing: { yards: 200 }, rushing: {}, receiving: {}, defense: {}, kicking: {}, specialTeams: {} } },
  ],
  injuries: [{ playerId: "p1", fullName: "Mason Hall", status: "questionable", availability: "limited", practiceStatus: null, bodyPart: null, notes: null, expectedReturn: null, reason: "ankle" }],
})
const splitCompare = comparePlayers(ctxSplit, "Compare Mason Hall and Tyler Nelson")
const hasSplitOrWinCategories = /Split advantages|leads on stats|healthier|ahead on depth/.test(splitCompare.summary)
console.log(hasSplitOrWinCategories || (splitCompare.summary.includes("Mason") && splitCompare.summary.includes("Tyler")) ? "ok: split or win categories or both names" : "fail")
console.log(splitCompare.basedOn != null ? "ok: comparison has basedOn" : "fail")

console.log("\n--- Explainability: top play + close alternative ---")
const ctxClosePlays = emptyCtx({
  domain: "playbooks",
  intent: "play_recommendation",
  formations: [{ id: "f1", name: "Trips Right", side: "offense", playbookId: "pb1", subFormationCount: 0, playCount: 3 }],
  plays: [
    { id: "pl1", name: "Flood", formation: "Trips Right", subformation: null, tags: ["Red Zone"], concept: "Flood", playType: null, notes: null, situation: "red zone", motion: null, assignmentsSummary: null },
    { id: "pl2", name: "Mesh", formation: "Trips Right", subformation: null, tags: ["Red Zone"], concept: "Mesh", playType: null, notes: null, situation: "red zone", motion: null, assignmentsSummary: null },
  ],
  entities: { ...EMPTY_ENTITIES, formationNames: ["Trips Right"], concepts: ["red zone"] },
})
const recClose = recommendPlaysForSituation(ctxClosePlays, "What are my best red zone plays from Trips Right?")
const hasCloseAlternative = /Close alternative|ranks first/.test(recClose.summary)
console.log(hasCloseAlternative ? "ok: ranks first or close alternative" : "fail")
console.log(recClose.summary.includes("Flood") && (recClose.summary.includes("Mesh") || recClose.details?.some((d) => d.includes("Mesh"))) ? "ok: both plays mentioned" : "fail")

console.log("\n--- Explainability: clear decisive top pick ---")
const ctxDecisive = emptyCtx({
  domain: "playbooks",
  intent: "play_recommendation",
  formations: [{ id: "f1", name: "Trips Right", side: "offense", playbookId: "pb1", subFormationCount: 0, playCount: 2 }],
  plays: [
    { id: "pl1", name: "Flood", formation: "Trips Right", subformation: null, tags: ["Red Zone"], concept: "Flood", playType: null, notes: null, situation: "red zone", motion: null, assignmentsSummary: null },
    { id: "pl2", name: "Mesh", formation: "Trips Right", subformation: null, tags: [], concept: "Mesh", playType: null, notes: null, situation: null, motion: null, assignmentsSummary: null },
  ],
  entities: { ...EMPTY_ENTITIES, formationNames: ["Trips Right"], concepts: ["red zone"] },
})
const recDecisive = recommendPlaysForSituation(ctxDecisive, "What are my best red zone plays from Trips Right?")
console.log(/ranks first|ranks 1st|Top pick/.test(recDecisive.summary) || recDecisive.summary.includes("Flood") ? "ok: decisive top pick mentions Flood or ranks first" : "fail")
console.log(recDecisive.basedOn != null ? "ok: play recommendation has basedOn" : "fail")

console.log("\n--- Data upgrades: player decision with recent game trend ---")
const ctxWithTrend = emptyCtx({
  domain: "players",
  intent: "player_decision",
  entities: { ...EMPTY_ENTITIES, positions: ["QB"] },
  players: [
    { ...basePlayer, id: "p1", fullName: "Mason Hall", primaryPosition: "QB", depthChartOrder: "1", starter: true, trendSummary: "last 3: 680 yds, 6 TD", recentGames: [{ stats: { passing_yards: 220, passing_tds: 2 } }] },
    { ...basePlayer, id: "p2", fullName: "Tyler Nelson", primaryPosition: "QB", depthChartOrder: "2", starter: false, trendSummary: "last 3: 310 yds, 2 TD" },
  ],
})
const decisionWithTrend = analyzePlayerDecision(ctxWithTrend, "Which QB should I start?")
console.log(decisionWithTrend.summary.includes("Mason") || decisionWithTrend.details?.some((d) => d.includes("recent") || d.includes("trend")) ? "ok: trend in decision" : "fail")
console.log(decisionWithTrend.confidence === "high" || decisionWithTrend.confidence === "medium" ? "ok: confidence with trend" : "fail")

console.log("\n--- Data upgrades: comparison with season vs recent ---")
const ctxCompareRecent = emptyCtx({
  domain: "players",
  intent: "player_comparison",
  entities: { ...EMPTY_ENTITIES, namedPlayers: ["Mason", "Tyler"] },
  players: [
    { ...basePlayer, id: "p1", fullName: "Mason Hall", stats: { passing: { yards: 1200, tds: 10 }, rushing: {}, receiving: {}, defense: {}, kicking: {}, specialTeams: {} }, trendSummary: "last 3: 720 yds, 7 TD" },
    { ...basePlayer, id: "p2", fullName: "Tyler Nelson", stats: { passing: { yards: 800, tds: 5 }, rushing: {}, receiving: {}, defense: {}, kicking: {}, specialTeams: {} }, trendSummary: "last 3: 450 yds, 4 TD" },
  ],
})
const compareRecent = comparePlayers(ctxCompareRecent, "Compare Mason and Tyler")
console.log(compareRecent.details?.some((d) => d.includes("recent") || d.includes("trend")) ? "ok: recent in comparison details" : "fail")

console.log("\n--- Data upgrades: play recommendation with success analytics ---")
const ctxPlayAnalytics = emptyCtx({
  domain: "playbooks",
  intent: "play_recommendation",
  plays: [
    { id: "pl1", name: "Flood", formation: "Trips Right", subformation: null, tags: ["Red Zone"], concept: "Flood", playType: null, notes: null, situation: "red zone", motion: null, assignmentsSummary: null, usageCount: 12, successRate: 0.67, avgYards: 8 },
    { id: "pl2", name: "Mesh", formation: "Trips Right", subformation: null, tags: ["Red Zone"], concept: "Mesh", playType: null, notes: null, situation: "red zone", motion: null, assignmentsSummary: null, usageCount: 8, successRate: 0.5, avgYards: 5 },
  ],
  entities: { ...EMPTY_ENTITIES, formationNames: ["Trips Right"], concepts: ["red zone"] },
})
const recAnalytics = recommendPlaysForSituation(ctxPlayAnalytics, "What are my best red zone plays?")
console.log(recAnalytics.summary.includes("Flood") || recAnalytics.details?.some((d) => d.includes("Flood")) ? "ok: play recommendation with analytics" : "fail")
console.log(recAnalytics.details?.some((d) => /success|rate|%|analytics/.test(d)) ? "ok: analytics mentioned" : "fail")

console.log("\n--- Data upgrades: play recommendation with matchup/tendency ---")
const ctxTendency = emptyCtx({
  domain: "playbooks",
  intent: "play_recommendation",
  schedule: [{ id: "g1", title: "Game vs Central", type: "game", start: "2024-10-01", end: null, opponent: "Central", location: null, notes: null }],
  opponentTendencies: [{ opponentName: "Central", coverageTendency: "Cover 3", pressureTendency: "heavy blitz", runPassTendency: null, redZoneTendency: null, tendencyCategory: null, downDistanceTendency: null, notes: null }],
  plays: [{ id: "pl1", name: "Flood", formation: "Trips Right", subformation: null, tags: [], concept: null, playType: null, notes: null, situation: null, motion: null, assignmentsSummary: null }],
  entities: { ...EMPTY_ENTITIES, concepts: ["red zone"] },
})
const recTendency = recommendPlaysForSituation(ctxTendency, "What plays fit our next opponent?")
console.log(recTendency.details?.some((d) => d.includes("Opponent") || d.includes("tendenc")) ? "ok: tendency in details" : "fail")

console.log("\n--- Data upgrades: injury summary with practice participation ---")
const ctxInjParticipation = emptyCtx({
  domain: "injuries",
  intent: "injury_summary",
  injuries: [
    { playerId: "p1", fullName: "Mason Hall", status: "questionable", availability: "limited", practiceStatus: null, bodyPart: null, notes: null, expectedReturn: "2024-10-01", reason: "ankle", practiceParticipation: "limited" },
  ],
  players: [{ ...basePlayer, id: "p1", fullName: "Mason Hall", starter: true }],
})
const injParticipation = summarizeInjuries(ctxInjParticipation, "Who was limited in practice?")
console.log(injParticipation.details?.some((d) => d.toLowerCase().includes("practice") || d.includes("limited")) ? "ok: practice participation in injury summary" : "fail")

console.log("\n--- Data upgrades: start/sit affected by limited practice ---")
const ctxLimitedPractice = emptyCtx({
  domain: "players",
  intent: "player_decision",
  entities: { ...EMPTY_ENTITIES, positions: ["QB"] },
  players: [
    { ...basePlayer, id: "p1", fullName: "Mason Hall", depthChartOrder: "1", starter: true, practiceParticipation: "limited" },
    { ...basePlayer, id: "p2", fullName: "Tyler Nelson", depthChartOrder: "2", starter: false, practiceParticipation: "full" },
  ],
})
const decisionLimited = analyzePlayerDecision(ctxLimitedPractice, "Which QB should I start this week?")
console.log(decisionLimited.details?.some((d) => d.includes("practice") || d.includes("participation")) ? "ok: participation in decision" : "fail")

console.log("\n--- Data upgrades: confidence high when structured analytics exist ---")
console.log(recAnalytics.confidence === "high" || recAnalytics.confidence === "medium" ? "ok: play rec confidence with analytics" : "fail")

console.log("\n--- Data upgrades: confidence medium/low when only partial data ---")
const ctxPartial = emptyCtx({ domain: "playbooks", intent: "play_recommendation", plays: [{ id: "pl1", name: "Flood", formation: "Trips Right", subformation: null, tags: [], concept: null, playType: null, notes: null, situation: null, motion: null, assignmentsSummary: null }], entities: { ...EMPTY_ENTITIES } })
const recPartial = recommendPlaysForSituation(ctxPartial, "Best red zone play?")
console.log(recPartial.confidence === "medium" || recPartial.confidence === "low" ? "ok: medium/low when partial" : "fail")

console.log("\nDone.")
