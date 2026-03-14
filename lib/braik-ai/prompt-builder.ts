import type { BraikContext, DetectedEntities } from "./types"
import { EMPTY_ENTITIES } from "./shared"

const SYSTEM_INSTRUCTIONS = `You are Coach B, Braik's football coaching assistant.

When Braik Team Context is provided (team data is present):
- Use only the data in the Braik Team Context below. Do not ask the coach to provide information that is already in that context.
- Never say "if you want me to retrieve it", "I can look that up", or "would you like me to fetch" when context is already provided—the data is already in the prompt; use it directly.
- For any recommendation (who to start, which play to call, who is available), you must cite the context in plain language: e.g. "Based on your roster...", "From your injury report...", "Using your Trips Right plays...". Name what you are using (roster, depth chart, playbook, schedule) so the coach sees the answer is grounded in their data.
- If something is missing from the context, say exactly what Braik has and what it does not have. Example: "Braik has your WR roster and depth order, but no stats in context—so I can't compare production." or "Your injury report shows X and Y out; Braik does not have practice participation data here."

When no team context is provided:
- Answer from general football knowledge. If the coach asks about their team, say you don't have their team data in this conversation.

Rules for all answers:
- Prefer concise, practical football answers. Combine domains when the question spans players, playbook, schedule, or injuries.
- Do not invent stats, injuries, or roster details not present in the context.
- Do not propose or execute actions outside of conversation—only answer questions and give coaching advice.`

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
      const parts = [`${p.fullName} #${p.jerseyNumber ?? "—"} ${p.primaryPosition ?? ""}`, p.availability, p.depthChartOrder ? `depth: ${p.depthChartOrder}` : null, p.injuryStatus ? `injury: ${p.injuryStatus}` : null, p.coachNotes ? `notes: ${String(p.coachNotes).slice(0, 80)}` : null].filter(Boolean)
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
      lines.push(`  ${p.name} | ${p.formation}${p.subformation ? ` / ${p.subformation}` : ""}${p.playType ? ` | ${p.playType}` : ""}${tags}`)
    })
    if (ctx.plays.length > 25) lines.push(`  ... and ${ctx.plays.length - 25} more`)
  }
  if (ctx.injuries.length > 0) {
    lines.push("\n--- Injury report ---")
    ctx.injuries.forEach((i) => lines.push(`  ${i.fullName}: ${i.reason}${i.expectedReturn ? ` (return ~${String(i.expectedReturn).slice(0, 10)})` : ""}`))
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
    lines.push("\n--- Reports ---")
    ctx.reports.forEach((r) => lines.push(`  ${r.source}: ${r.excerpt.slice(0, 150)}...`))
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
}

/**
 * Build system + Braik context + conversation for OpenAI.
 */
export function buildCoachBPrompt(input: BuildPromptInput): { instructions: string; input: string | Array<{ role: "user" | "assistant" | "system" | "developer"; content: string; type?: "message" }> } {
  const { context, message, history } = input
  const contextBlock = formatContextBlock(context)
  const instructions = `${SYSTEM_INSTRUCTIONS}\n\nBraik Team Context:\n${contextBlock}`

  if (process.env.BRAIK_AI_DEBUG === "1") {
    console.log("[Coach B debug] prompt: domain=%s intent=%s contextBlocks=%s historyLen=%s", context.domain, context.intent, contextBlock.split("\n").length, history.length)
  }

  const conversation = history
    .map((h) => ({ role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: h.content, type: "message" as const }))
    .concat([{ role: "user" as const, content: message, type: "message" as const }])

  const inputPayload = conversation.length <= 1 ? message : conversation
  return { instructions, input: inputPayload }
}
