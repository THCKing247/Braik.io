/**
 * Coach B answer-format consistency: prompt instructions and expected concise answer shape.
 * Run: npx tsx tests/braik-ai-prompt-format.test.ts
 */
import { buildCoachBPrompt, createGenericContext } from "../lib/braik-ai/prompt-builder"
import type { BraikContext } from "../lib/braik-ai/types"
import { EMPTY_ENTITIES } from "../lib/braik-ai/shared"
import type { CoordinatorResult } from "../lib/braik-ai/coordinator-tools"

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

function withCoordinator(
  context: BraikContext,
  message: string,
  tool: string,
  result: CoordinatorResult
) {
  return buildCoachBPrompt({
    context,
    message,
    history: [],
    coordinatorAnalysis: { tool, result },
  })
}

console.log("--- Prompt contains scan-friendly format rules ---")
const withAnalysis = withCoordinator(
  emptyCtx({ domain: "players", intent: "player_decision" }),
  "Which QB should I start?",
  "analyzePlayerDecision",
  {
    summary: "#1: Mason Hall #12 (QB) — starter, available. Top factors: starter/depth, availability.",
    details: ["Based on: starter/depth, availability and depth/availability."],
    limitations: [],
    confidence: "high",
    basedOn: "Based on: depth chart and availability.",
  }
)
const instructions = withAnalysis.instructions
console.log(instructions.includes("First sentence") || instructions.includes("Direct answer") ? "ok: first-sentence rule" : "fail")
console.log(instructions.includes("2–3 short") ? "ok: 2-3 reason sentences" : "fail")
console.log(instructions.includes("limitation") && instructions.includes("only if needed") ? "ok: limitation only if needed" : "fail")
console.log(instructions.includes("scan-friendly") || instructions.includes("easy to scan") ? "ok: scan-friendly" : "fail")

console.log("\n--- Prompt contains comparison/play/metadata/follow-up rules ---")
console.log(instructions.includes("split advantages") || instructions.includes("Split advantages") ? "ok: comparison rule" : "fail")
console.log(instructions.includes("top pick") && instructions.includes("close alternative") ? "ok: play recommendation rule" : "fail")
console.log(instructions.includes("metadata") && instructions.includes("document") ? "ok: metadata-only rule" : "fail")
console.log(instructions.includes("clarifying") || instructions.includes("clarify") ? "ok: ambiguous follow-up rule" : "fail")

console.log("\n--- Concise player recommendation (example shape) ---")
const examplePlayerRec = `Start Mason Hall.
He's your string 1 and available; the analysis favors him on depth and availability.
Based on depth and availability only—Braik doesn't have stats in context.`
const playerLines = examplePlayerRec.split("\n").filter((l) => l.trim().length > 0)
console.log(playerLines.length >= 2 && playerLines.length <= 4 ? "ok: 2-4 lines" : "fail")
console.log(playerLines[0].endsWith(".") && playerLines[0].length < 120 ? "ok: first sentence direct and short" : "fail")

console.log("\n--- Concise comparison (example shape) ---")
const exampleComparison = `Mason leads on stats; Tyler is healthier.
Mason has more production; Tyler is full go. Depth favors Mason.`
const compLines = exampleComparison.split("\n").filter((l) => l.trim().length > 0)
console.log(compLines.length >= 2 && compLines.length <= 4 ? "ok: 2-4 lines" : "fail")
console.log(/leads on|healthier|favors/.test(exampleComparison) ? "ok: split advantages present" : "fail")

console.log("\n--- Concise play recommendation (example shape) ---")
const examplePlayRec = `Flood is the top pick.
It matches Trips Right and is tagged for red zone. Mesh is a close alternative if you want a second look.`
const playLines = examplePlayRec.split("\n").filter((l) => l.trim().length > 0)
console.log(playLines.length >= 2 && playLines.length <= 4 ? "ok: 2-4 lines" : "fail")
console.log(examplePlayRec.includes("top pick") && examplePlayRec.includes("close alternative") ? "ok: top pick and close alternative" : "fail")

console.log("\n--- Concise metadata-only report (example shape) ---")
const exampleMetadataOnly = `Braik only has document metadata here—no extracted text to summarize.
You have: Practice Plan (practice_plan). I can't pull key points from the contents.`
const metaLines = exampleMetadataOnly.split("\n").filter((l) => l.trim().length > 0)
console.log(metaLines.length >= 1 && metaLines.length <= 3 ? "ok: 1-3 lines" : "fail")
console.log(/metadata|no extracted|can't summarize/i.test(exampleMetadataOnly) ? "ok: metadata-only stated clearly" : "fail")

console.log("\n--- Concise ambiguous follow-up (example shape) ---")
const exampleAmbiguous = `Which player do you mean—Mason or Tyler?`
const ambigLines = exampleAmbiguous.split("\n").filter((l) => l.trim().length > 0)
console.log(ambigLines.length >= 1 && ambigLines.length <= 2 ? "ok: 1-2 lines" : "fail")
console.log(/\?/.test(exampleAmbiguous) && exampleAmbiguous.length < 80 ? "ok: one short clarifying question" : "fail")

console.log("\n--- Prompt built without coordinator (no format regression) ---")
const noAnalysis = buildCoachBPrompt({
  context: emptyCtx(),
  message: "What's the weather?",
  history: [],
})
console.log(noAnalysis.instructions.includes("Coach B") ? "ok: system instructions present" : "fail")
console.log(noAnalysis.input === "What's the weather?" ? "ok: input unchanged" : "fail")

console.log("\nDone.")