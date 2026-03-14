/**
 * Follow-up detection and context resolution for Coach B.
 * When the user asks a vague, referential follow-up (e.g. "what about the backup?", "summarize that"),
 * reuse the prior turn's domain/entity context so the model can answer in scope.
 */

import type { BraikContext, DetectedEntities } from "./types"

export type ConversationTurn = { role: string; content: string }

/** Referential / underspecified phrases that suggest the user is referring to the previous answer. */
const REFERENTIAL_PATTERNS = [
  /\b(what|who|which)\s+about\s+(the\s+)?/i,
  /\b(what|who)\s+is\s+(the\s+)?(backup|starter|next)\b/i,
  /\bwhich\s+one\s+(is|do|should|would)/i,
  /\b(and\s+)?(who|what)\s+(is|are|do|does|next)\b/i,
  /\b(summarize|explain|elaborate|clarify)\s+(that|this|more)\b/i,
  /\b(what|how)\s+does\s+that\s+(mean|work)\b/i,
  /\b(what\s+about|how\s+about)\s+(him|her|them|the\s+backup|the\s+starter)/i,
  /\b(that|those|them|him|her)\b.*\b(too|as\s+well|instead)\b/i,
  /\b(the\s+)?(backup|starter|other\s+one|next\s+one)\b/i,
  /\b(better|best|worse)\b/i,
  /\bcompare\s+(them|those|these)\b/i,
  /\bmore\s+(detail|details|info|on\s+that)\b/i,
  /\b(that\s+one|this\s+one)\b/i,
]

/** Short, vague messages that often depend on prior context (word count or very generic). */
const VAGUE_LENGTH_THRESHOLD = 6

/**
 * Returns the last user message in conversation history (most recent first when scanning backwards).
 */
export function getLastUserMessage(history: ConversationTurn[]): string | null {
  if (!Array.isArray(history) || history.length === 0) return null
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === "user" && typeof history[i].content === "string") {
      const c = String(history[i].content).trim()
      return c.length > 0 ? c : null
    }
  }
  return null
}

/**
 * True if the message looks referential/underspecified and we have prior turns to resolve from.
 * We only treat as follow-up when:
 * - There is at least one prior user message in history, and
 * - The current message either matches referential phrases or is very short/vague.
 */
export function detectFollowUp(message: string, history: ConversationTurn[]): boolean {
  const trimmed = message.trim()
  if (!trimmed || !Array.isArray(history) || history.length === 0) return false
  const lastUser = getLastUserMessage(history)
  if (!lastUser) return false

  const hasReferential = REFERENTIAL_PATTERNS.some((re) => re.test(trimmed))
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  const isShortAndVague = wordCount <= VAGUE_LENGTH_THRESHOLD && (/\b(that|those|him|her|them|which|what|who|backup|starter|better|summarize|explain|more)\b/i.test(trimmed))

  return hasReferential || isShortAndVague
}

/**
 * Whether current context has weak or empty entity/domain signals for the given domain.
 */
function isWeakInDomain(ctx: BraikContext, domain: "players" | "playbooks" | "reports" | "schedule" | "injuries"): boolean {
  switch (domain) {
    case "players":
      return (ctx.entities.namedPlayers.length === 0 && ctx.entities.positions.length === 0) || ctx.players.length === 0
    case "playbooks":
      return (ctx.entities.formationNames.length === 0 && ctx.entities.playNames.length === 0 && ctx.entities.concepts.length === 0) || (ctx.formations.length === 0 && ctx.plays.length === 0)
    case "reports":
      return ctx.reports.length === 0
    case "schedule":
      return ((ctx.entities.opponents.length === 0 && ctx.entities.dateTimeRefs.length === 0) || ctx.schedule.length === 0)
    case "injuries":
      return ctx.injuries.length === 0
    default:
      return true
  }
}

/**
 * Merge prior entities into current when current is empty (dedupe).
 */
function mergeEntities(current: DetectedEntities, prior: DetectedEntities): DetectedEntities {
  return {
    namedPlayers: [...new Set([...current.namedPlayers, ...prior.namedPlayers])],
    positions: [...new Set([...current.positions, ...prior.positions])],
    formationNames: [...new Set([...current.formationNames, ...prior.formationNames])],
    playNames: [...new Set([...current.playNames, ...prior.playNames])],
    concepts: [...new Set([...current.concepts, ...prior.concepts])],
    dateTimeRefs: [...new Set([...current.dateTimeRefs, ...prior.dateTimeRefs])],
    opponents: [...new Set([...current.opponents, ...prior.opponents])],
  }
}

/**
 * Resolve follow-up by carrying forward prior context when the current context is underspecified.
 * Prefer current when it has concrete entities; otherwise reuse prior for that domain.
 * Does not over-apply: only fills in where current is weak and prior had data.
 */
export function resolveFollowUpContext(
  _message: string,
  _history: ConversationTurn[],
  currentContext: BraikContext,
  priorContext: BraikContext
): BraikContext {
  const out = { ...currentContext }

  if (isWeakInDomain(currentContext, "players") && !isWeakInDomain(priorContext, "players")) {
    out.players = priorContext.players.length > 0 ? [...priorContext.players] : out.players
    out.entities = mergeEntities(currentContext.entities, priorContext.entities)
  }
  if (isWeakInDomain(currentContext, "playbooks") && !isWeakInDomain(priorContext, "playbooks")) {
    if (priorContext.playbooks.length > 0) out.playbooks = [...priorContext.playbooks]
    if (priorContext.formations.length > 0) out.formations = [...priorContext.formations]
    if (priorContext.plays.length > 0) out.plays = [...priorContext.plays]
    out.entities = mergeEntities(out.entities, priorContext.entities)
  }
  if (isWeakInDomain(currentContext, "reports") && !isWeakInDomain(priorContext, "reports")) {
    if (priorContext.reports.length > 0) out.reports = [...priorContext.reports]
  }
  if (isWeakInDomain(currentContext, "schedule") && !isWeakInDomain(priorContext, "schedule")) {
    if (priorContext.schedule.length > 0) out.schedule = [...priorContext.schedule]
    out.entities = mergeEntities(out.entities, priorContext.entities)
  }
  if (isWeakInDomain(currentContext, "injuries") && !isWeakInDomain(priorContext, "injuries")) {
    if (priorContext.injuries.length > 0) out.injuries = [...priorContext.injuries]
  }

  if (currentContext.rosterSummary === null && priorContext.rosterSummary !== null) {
    out.rosterSummary = priorContext.rosterSummary
  }

  out.limitations = [...currentContext.limitations]
  if (out.players.length > currentContext.players.length || out.plays.length > currentContext.plays.length || out.reports.length > currentContext.reports.length) {
    const added: string[] = []
    if (out.players.length > currentContext.players.length) added.push("players from previous question")
    if (out.plays.length > currentContext.plays.length || out.formations.length > currentContext.formations.length) added.push("playbook context from previous question")
    if (out.reports.length > currentContext.reports.length) added.push("report/document context from previous question")
    if (added.length > 0) {
      out.limitations = out.limitations.filter((l) => !l.includes("previous question"))
      out.limitations.push(`(Using ${added.join(" and ")} to answer this follow-up.)`)
    }
  }

  return out
}
