export type VoiceIntentType = "chat" | "recommendation" | "app_action" | "navigation"

export type ClassifiedVoiceCommand = {
  intentType: VoiceIntentType
  actionName?: string
  confidence: number
  requiresConfirmation: boolean
  /** Optional normalized detail for routing */
  detail?: string
}

const CONFIRM_ACTIONS = new Set([
  "notify_all_parents",
  "notify_all_players",
  "bulk_roster_edit",
  "send_team_broadcast",
])

const NAV_PATTERNS: Array<{ re: RegExp; actionName: string; confidence: number }> = [
  { re: /\b(open|show|go to)\s+(the\s+)?depth\s*chart\b/i, actionName: "open_depth_chart", confidence: 0.85 },
  { re: /\bdepth\s*chart\b/i, actionName: "open_depth_chart", confidence: 0.65 },
  { re: /\b(open|show)\s+(the\s+)?(schedule|calendar)\b/i, actionName: "open_schedule", confidence: 0.85 },
  { re: /\bnext\s+game\b/i, actionName: "open_schedule", confidence: 0.75 },
  { re: /\b(open|go to)\s+messages?\b/i, actionName: "open_messages", confidence: 0.85 },
  { re: /\b(playbook|playbooks)\b/i, actionName: "open_playbooks", confidence: 0.55 },
]

const REC_PATTERNS: RegExp[] = [
  /\b(what\s+should\s+we\s+run|what\s+do\s+you\s+run|against\s+cover|vs\.?\s+cover|red\s*zone|third\s+and|3rd\s+and)\b/i,
  /\b(call|concept|mesh|flood|stick|levels|smash|slant|fade|inside\s+zone|outside\s+zone|power|counter)\b/i,
  /\b(leverage|matchup|motion|tempo|spacing|reads?|coverage)\b/i,
]

const APP_ACTION_PATTERNS: Array<{ re: RegExp; actionName: string; confidence: number; risky: boolean }> = [
  {
    re: /\b(notify|tell)\s+(everyone|all\s+parents|all\s+players|the\s+team)\b/i,
    actionName: "notify_all_parents",
    confidence: 0.7,
    risky: true,
  },
  {
    re: /\b(message|text|email)\s+parents\b/i,
    actionName: "draft_parent_message",
    confidence: 0.65,
    risky: false,
  },
  {
    re: /\b(add|create|schedule)\s+.+\s+(practice|event|meeting)\b/i,
    actionName: "draft_calendar_event",
    confidence: 0.6,
    risky: false,
  },
]

/**
 * Lightweight intent routing after STT — no extra model call.
 * Risky actions still flow through Coach B tools with confirmation on the server.
 */
export function classifyVoiceCommand(
  transcript: string,
  _context?: { pathname?: string; teamId?: string }
): ClassifiedVoiceCommand {
  const t = transcript.trim()
  if (!t) {
    return { intentType: "chat", confidence: 0.3, requiresConfirmation: false }
  }

  const lower = t.toLowerCase()

  for (const { re, actionName, confidence } of NAV_PATTERNS) {
    if (re.test(t)) {
      return {
        intentType: "navigation",
        actionName,
        confidence,
        requiresConfirmation: false,
        detail: t,
      }
    }
  }

  for (const { re, actionName, confidence, risky } of APP_ACTION_PATTERNS) {
    if (re.test(t)) {
      return {
        intentType: "app_action",
        actionName,
        confidence,
        requiresConfirmation: risky || CONFIRM_ACTIONS.has(actionName),
        detail: t,
      }
    }
  }

  if (REC_PATTERNS.some((re) => re.test(t))) {
    return {
      intentType: "recommendation",
      confidence: 0.72,
      requiresConfirmation: false,
      detail: t,
    }
  }

  // Short tactical questions default to recommendation
  if (t.length < 140 && /\?/.test(t) && /\b(run|play|call|check)\b/i.test(t)) {
    return { intentType: "recommendation", confidence: 0.55, requiresConfirmation: false, detail: t }
  }

  return { intentType: "chat", confidence: 0.55, requiresConfirmation: false, detail: t }
}
