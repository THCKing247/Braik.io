import type { BraikContext, DetectedEntities } from "./types"
import type { CoordinatorAnalysis } from "./coordinator-tools"
import { EMPTY_ENTITIES } from "./shared"

const SYSTEM_INSTRUCTIONS = `You are Coach B, Braik's football coaching assistant. Keep every response short, direct, and easy to scan.

Answer format (strict; coaches scan quickly):
1. First sentence: Direct answer or recommendation only. No lead-in. (e.g. "Start Mason Hall." / "Flood is the top pick." / "Braik only has document metadata—I can't summarize the contents.")
2. Next: 2–3 short reason sentences. Ground each in Braik data (depth, injury report, formation, schedule, recent game trend, play success analytics, opponent tendencies, practice participation). When richer data is present, say so naturally (e.g. "Based on the last 3 games, Mason has been your most productive back." / "Flood has the strongest red zone fit and the best success rate in context." / "Your next opponent shows pressure tendencies, so Mesh is the safer answer." / "Mason was limited in practice, so this is more of a game-time decision."). No long paragraphs unless the user explicitly asks for detail.
3. Last (only if needed): One short limitation sentence. If nothing is missing, omit it.

When Braik Team Context is provided:
- Use only the data in the Braik Team Context below. Do not ask for information that is already there.
- Never say "if you want me to retrieve it", "I can look that up", or "would you like me to fetch" when context is provided—use the data directly.
- For reports/documents: when extracted content is provided, summarize from it. When only metadata (titles/categories) is listed, state clearly that Braik only has document metadata and no extracted text to summarize.

When no team context is provided:
- Answer from general football knowledge. If the coach asks about their team, say you don't have their team data in this conversation.

Rules for all answers:
- Be concise and practical. Avoid long paragraphs unless the user explicitly asks for detail.
- Do not invent stats, injuries, or roster details not in the context.
- Do not propose or execute actions—only answer and give coaching advice.`

/** Max length for the Braik context block to avoid token explosion. */
const MAX_CONTEXT_BLOCK_CHARS = 12_000

/** Build a minimal context for generic fallback (no team or failed build). */
export function createGenericContext(limitations: string[] = []): BraikContext {
  return {
    team: null,
    domain: "generic",
    intent: "generic",
    relatedDomains: [],
    entities: { ...EMPTY_ENTITIES } as DetectedEntities,
    players: [],
    playbooks: [],
    formations: [],
    plays: [],
    injuries: [],
    schedule: [],
    rosterSummary: null,
    reports: [],
    opponentTendencies: [],
    limitations,
  }
}

function formatContextBlock(ctx: BraikContext): string {
  const lines: string[] = []
  lines.push(`Team: ${ctx.team?.name ?? "Unknown"} (ID: ${ctx.team?.id ?? "—"})`)
  lines.push(`Domain: ${ctx.domain} | Intent: ${ctx.intent}`)
  if (ctx.relatedDomains.length > 0) lines.push(`Related: ${ctx.relatedDomains.join(", ")}`)
  if (ctx.entities.positions.length > 0) lines.push(`Positions mentioned: ${ctx.entities.positions.join(", ")}`)
  if (ctx.entities.namedPlayers.length > 0) lines.push(`Players mentioned: ${ctx.entities.namedPlayers.join(", ")}`)
  if (ctx.entities.formationNames.length > 0) lines.push(`Formations: ${ctx.entities.formationNames.join(", ")}`)
  if (ctx.entities.concepts.length > 0) lines.push(`Concepts: ${ctx.entities.concepts.slice(0, 10).join(", ")}`)

  if (ctx.players.length > 0) {
    lines.push("\n--- Players ---")
    ctx.players.slice(0, 30).forEach((p) => {
      const parts = [`${p.fullName} #${p.jerseyNumber ?? "—"} ${p.primaryPosition ?? ""}`, p.availability, p.depthChartOrder ? `depth: ${p.depthChartOrder}` : null, p.injuryStatus ? `injury: ${p.injuryStatus}` : null, p.trendSummary ? `recent: ${p.trendSummary}` : null, p.practiceParticipation ? `practice: ${p.practiceParticipation}` : null, p.coachNotes ? `notes: ${String(p.coachNotes).slice(0, 80)}` : null].filter(Boolean)
      lines.push("  " + parts.join(" | "))
    })
    if (ctx.players.length > 30) lines.push(`  ... and ${ctx.players.length - 30} more`)
  }
  if (ctx.playbooks.length > 0) {
    lines.push("\n--- Playbooks ---")
    ctx.playbooks.forEach((p) => lines.push(`  ${p.name}`))
  }
  if (ctx.formations.length > 0) {
    lines.push("\n--- Formations ---")
    ctx.formations.slice(0, 20).forEach((f) => lines.push(`  ${f.name} (${f.side})`))
  }
  if (ctx.plays.length > 0) {
    lines.push("\n--- Plays (sample) ---")
    ctx.plays.slice(0, 25).forEach((p) => {
      const tags = p.tags?.length ? ` [${p.tags.slice(0, 3).join(", ")}]` : ""
      const analytics = p.successRate != null ? ` success ${Math.round((p.successRate ?? 0) * 100)}%` : p.avgYards != null ? ` avg ${p.avgYards} yds` : ""
      lines.push(`  ${p.name} | ${p.formation}${p.subformation ? ` / ${p.subformation}` : ""}${p.playType ? ` | ${p.playType}` : ""}${tags}${analytics}`)
    })
    if (ctx.plays.length > 25) lines.push(`  ... and ${ctx.plays.length - 25} more`)
  }
  if (ctx.opponentTendencies?.length > 0) {
    lines.push("\n--- Opponent tendencies (next opponent) ---")
    ctx.opponentTendencies.slice(0, 5).forEach((t) => {
      const parts = [t.coverageTendency, t.pressureTendency, t.runPassTendency, t.redZoneTendency].filter(Boolean)
      if (parts.length) lines.push(`  ${t.opponentName}: ${parts.join("; ")}`)
    })
  }
  if (ctx.injuries.length > 0) {
    lines.push("\n--- Injury report ---")
    ctx.injuries.forEach((i) => {
      const part = i.practiceParticipation ? ` practice: ${i.practiceParticipation}` : ""
      lines.push(`  ${i.fullName}: ${i.reason}${i.expectedReturn ? ` (return ~${String(i.expectedReturn).slice(0, 10)})` : ""}${part}`)
    })
  }
  if (ctx.schedule.length > 0) {
    lines.push("\n--- Schedule ---")
    ctx.schedule.slice(0, 12).forEach((s) => {
      if (s.type === "game") lines.push(`  ${s.start.slice(0, 10)} Game vs ${s.opponent ?? "TBD"}`)
      else lines.push(`  ${s.start.slice(0, 10)} ${s.title}`)
    })
  }
  if (ctx.rosterSummary) {
    lines.push("\n--- Roster summary ---")
    lines.push(`  Total: ${ctx.rosterSummary.totalPlayers}`)
    lines.push(`  By position: ${Object.entries(ctx.rosterSummary.countsByPosition).map(([k, v]) => `${k}: ${v}`).join(", ")}`)
  }
  if (ctx.reports.length > 0) {
    const withContent = ctx.reports.filter((r) => r.hasExtractedText)
    const metadataOnly = ctx.reports.filter((r) => !r.hasExtractedText)
    if (withContent.length > 0) {
      lines.push("\n--- Reports / documents (with extracted content) ---")
      withContent.slice(0, 15).forEach((r) => {
        lines.push(`  [${r.source}] ${(r.type ?? "document").slice(0, 40)} — content:`)
        lines.push(r.excerpt)
      })
    }
    if (metadataOnly.length > 0) {
      lines.push("\n--- Reports / documents (metadata only) ---")
      if (withContent.length === 0) lines.push("  (No extracted text for these; only titles/categories.)")
      metadataOnly.slice(0, 20).forEach((r) => lines.push(`  ${r.source}: ${r.excerpt.slice(0, 120)}`))
    }
  }
  if (ctx.limitations.length > 0) {
    lines.push("\n--- Limitations ---")
    ctx.limitations.forEach((l) => lines.push(`  - ${l}`))
  }
  const block = lines.join("\n")
  if (block.length > MAX_CONTEXT_BLOCK_CHARS) {
    return block.slice(0, MAX_CONTEXT_BLOCK_CHARS) + "\n\n[Context truncated for length.]"
  }
  return block
}

export interface BuildPromptInput {
  context: BraikContext
  message: string
  history: Array<{ role: string; content: string }>
  role?: string
  /** Optional pre-analysis from runCoordinatorTool; included as Coordinator Analysis section. */
  coordinatorAnalysis?: CoordinatorAnalysis | null
}

function formatCoordinatorAnalysis(analysis: CoordinatorAnalysis): string {
  const { tool, result } = analysis
  const lines: string[] = [
    `Coordinator Analysis (${tool}) [confidence: ${result.confidence}]:`,
    result.summary,
  ]
  if (result.basedOn) {
    lines.push(`  ${result.basedOn}`)
  }
  if (result.details?.length) {
    result.details.forEach((d) => lines.push(`  - ${d}`))
  }
  if (result.limitations.length) {
    lines.push("  Limitations: " + result.limitations.join("; "))
  }
  return lines.join("\n")
}

const COORDINATOR_RESPONSE_STYLE = `When Coordinator Analysis is present, use this response style exactly (scan-friendly, short):

1. First sentence: Direct answer or recommendation only. No lead-in.
2. Next: 2–3 short reason sentences grounded in Braik Team Context and the Coordinator Analysis. No long paragraphs.
3. Last: One short limitation sentence only if needed (low/medium confidence or analysis lists limitations). If confidence is high and no limitations, omit it.

By type:
- Comparisons: State split advantages in one compact sentence (e.g. "Mason leads on stats; Tyler is healthier."). Preserve who wins where from the analysis.
- Play recommendations: Clearly identify the top pick and, if applicable, the close alternative in 1–2 sentences. Preserve ranking from the analysis.
- Metadata-only reports: State clearly that Braik only has document metadata (no extracted text to summarize). One sentence is enough.
- Ambiguous follow-up: Ask one short clarifying question (e.g. "Which player do you mean—Mason or Tyler?"). Do not guess.

When the Coordinator Analysis includes ranked options (#1, #2, Top pick, Close alternative, Split advantages): preserve that ranking in your answer. Keep it concise—do not flatten into long bullet lists.`

/**
 * Build system + Braik context + optional Coordinator Analysis + conversation for OpenAI.
 */
export function buildCoachBPrompt(input: BuildPromptInput): { instructions: string; input: string | Array<{ role: "user" | "assistant" | "system" | "developer"; content: string; type?: "message" }> } {
  const { context, message, history, coordinatorAnalysis } = input
  const contextBlock = formatContextBlock(context)
  let instructions = `${SYSTEM_INSTRUCTIONS}\n\nBraik Team Context:\n${contextBlock}`

  if (coordinatorAnalysis?.result) {
    instructions += "\n\n--- " + formatCoordinatorAnalysis(coordinatorAnalysis)
    instructions += "\n\n" + COORDINATOR_RESPONSE_STYLE
    instructions += "\n\nKeep the reply scan-friendly: first sentence = direct answer; then 2–3 short reasons; then one short limitation only if needed. Use Coordinator Analysis and Braik Team Context only; do not invent facts."
  }

  if (process.env.BRAIK_AI_DEBUG === "1") {
    console.log("[Coach B debug] prompt: domain=%s intent=%s contextBlocks=%s historyLen=%s coordinatorTool=%s", context.domain, context.intent, contextBlock.split("\n").length, history.length, coordinatorAnalysis?.tool ?? "none")
  }

  const conversation = history
    .map((h) => ({ role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: h.content, type: "message" as const }))
    .concat([{ role: "user" as const, content: message, type: "message" as const }])

  const inputPayload = conversation.length <= 1 ? message : conversation
  return { instructions, input: inputPayload }
}
