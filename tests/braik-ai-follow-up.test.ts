/**
 * Follow-up detection and context resolution for Coach B.
 * Run: npx tsx tests/braik-ai-follow-up.test.ts
 */
import { detectFollowUp, getLastUserMessage, resolveFollowUpContext } from "../lib/braik-ai/follow-up"
import type { BraikContext } from "../lib/braik-ai/types"
import { EMPTY_ENTITIES } from "../lib/braik-ai/shared"

type Turn = { role: string; content: string }

function history(...turns: Turn[]): Turn[] {
  return turns
}

// ─── getLastUserMessage ────────────────────────────────────────────────────
console.log("--- getLastUserMessage ---")
const h1 = history(
  { role: "user", content: "Who should I start at QB?" },
  { role: "assistant", content: "Based on your roster..." }
)
console.log(getLastUserMessage(h1) === "Who should I start at QB?" ? "ok" : "fail: last user")

const h2 = history(
  { role: "user", content: "Compare my RBs" },
  { role: "assistant", content: "..." },
  { role: "user", content: "What about the backup?" }
)
console.log(getLastUserMessage(h2) === "What about the backup?" ? "ok" : "fail: last user in multi")

// ─── detectFollowUp: referential / vague ────────────────────────────────────
console.log("\n--- detectFollowUp ---")

const followUpMessages = [
  "What about the backup?",
  "Which one is better?",
  "What does that mean?",
  "And who is next?",
  "Summarize that more",
  "Explain that",
  "What about him?",
  "How about the starter?",
]
for (const msg of followUpMessages) {
  const out = detectFollowUp(msg, h1)
  console.log(out ? "ok" : "fail", msg.slice(0, 35))
}

const notFollowUpMessages = [
  "Who should I start at QB?",
  "Show me my Trips Right plays",
  "What is our schedule next week?",
]
for (const msg of notFollowUpMessages) {
  const out = detectFollowUp(msg, [])
  console.log(!out ? "ok (no history)" : "fail", msg.slice(0, 35))
}

// ─── resolveFollowUpContext: players ────────────────────────────────────────
console.log("\n--- resolveFollowUpContext (players) ---")

const emptyCtx = (): BraikContext => ({
  team: { id: "t1", name: "Team" },
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
  limitations: [],
})

const priorWithPlayers: BraikContext = {
  ...emptyCtx(),
  domain: "players",
  players: [
    {
      id: "p1",
      fullName: "John Smith",
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
    },
  ],
  entities: { ...EMPTY_ENTITIES, namedPlayers: ["John Smith"] },
}

const currentVague: BraikContext = {
  ...emptyCtx(),
  domain: "generic",
  entities: { ...EMPTY_ENTITIES },
}

const resolved = resolveFollowUpContext("What about the backup?", h1, currentVague, priorWithPlayers)
console.log(resolved.players.length === 1 && resolved.players[0].fullName === "John Smith" ? "ok: players carried forward" : "fail: players")

// ─── resolveFollowUpContext: playbooks ─────────────────────────────────────
console.log("\n--- resolveFollowUpContext (playbooks) ---")

const priorWithPlays: BraikContext = {
  ...emptyCtx(),
  domain: "playbooks",
  formations: [{ id: "f1", name: "Trips Right", side: "offense", playbookId: "pb1", subFormationCount: 0, playCount: 5 }],
  plays: [
    {
      id: "pl1",
      name: "Flood",
      formation: "Trips Right",
      subformation: null,
      tags: [],
      concept: "Flood",
      playType: null,
      notes: null,
      situation: null,
      motion: null,
      assignmentsSummary: null,
    },
  ],
  entities: { ...EMPTY_ENTITIES, formationNames: ["Trips Right"], concepts: ["Flood"] },
}

const currentNoPlaybook: BraikContext = { ...emptyCtx(), formations: [], plays: [] }
const resolvedPb = resolveFollowUpContext("Which one is better?", h1, currentNoPlaybook, priorWithPlays)
console.log(resolvedPb.formations.length === 1 && resolvedPb.plays.length === 1 ? "ok: formations/plays carried forward" : "fail: playbook")

// ─── resolveFollowUpContext: reports ───────────────────────────────────────
console.log("\n--- resolveFollowUpContext (reports) ---")

const priorWithReports: BraikContext = {
  ...emptyCtx(),
  domain: "reports",
  reports: [
    { id: "r1", source: "Team document", excerpt: "Practice plan: Monday 3pm...", type: "practice_plan", hasExtractedText: true },
  ],
}

const currentNoReports: BraikContext = { ...emptyCtx(), reports: [] }
const resolvedRep = resolveFollowUpContext("Summarize that more", h1, currentNoReports, priorWithReports)
console.log(resolvedRep.reports.length === 1 ? "ok: reports carried forward" : "fail: reports")

// ─── Do not over-apply: current has entities ───────────────────────────────
console.log("\n--- Do not over-apply ---")

const currentWithPlayer: BraikContext = {
  ...emptyCtx(),
  domain: "players",
  players: [
    {
      id: "p2",
      fullName: "Jane Doe",
      jerseyNumber: 5,
      primaryPosition: "WR",
      secondaryPositions: null,
      classYear: null,
      height: null,
      weight: null,
      starter: false,
      depthChartOrder: "2",
      availability: "available",
      injuryStatus: null,
      profileSummary: null,
      coachNotes: null,
      stats: { passing: {}, rushing: {}, receiving: {}, defense: {}, kicking: {}, specialTeams: {} },
    },
  ],
  entities: { ...EMPTY_ENTITIES, namedPlayers: ["Jane Doe"] },
}

const noMerge = resolveFollowUpContext("What about her?", h1, currentWithPlayer, priorWithPlayers)
console.log(noMerge.players.length === 1 && noMerge.players[0].fullName === "Jane Doe" ? "ok: current kept when already specified" : "fail: should not replace current")

console.log("\nDone.")
