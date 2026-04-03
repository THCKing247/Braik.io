import type { VoiceModeKey } from "@/lib/config/voice-modes"

/**
 * Optional client/server hints for TTS tone selection.
 * `action` aligns with Coach B tool / proposal `actionType` where applicable.
 */
export type VoiceContext = {
  page?: string
  action?: string
  intent?: string
}

export type ResolveVoiceModeInput = {
  page?: string
  action?: string
  intent?: string
  /** User or detector: live game context */
  isLiveGame?: boolean
  isPractice?: boolean
  isMessaging?: boolean
  isSidelineModeEnabled?: boolean
  /** Explicit UI override — always wins */
  manualModeOverride?: VoiceModeKey | null
}

/**
 * Infer a coarse `page` segment from the app URL (for Coach B widget / TTS).
 */
export function inferPageFromPathname(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined
  const p = pathname.toLowerCase()
  if (p.includes("/calendar") || p.includes("/schedule")) return "calendar"
  if (p.includes("/message") || p.includes("/messaging")) return "messaging"
  if (p.includes("/playbook") || p.includes("/play/")) return "playbooks"
  if (p.includes("/roster")) return "roster"
  return undefined
}

function fromLegacyContext(context: VoiceContext | undefined | null): ResolveVoiceModeInput {
  if (!context) return {}
  return {
    page: context.page,
    action: context.action,
    intent: context.intent,
  }
}

/**
 * Resolve TTS / Coach B voice mode from route, tools, intents, sideline, and overrides.
 * Order: manual override → sideline (live) → messaging → practice actions → calendar → game → playbooks → default.
 */
export function resolveVoiceModeFromInput(input: ResolveVoiceModeInput | undefined | null): VoiceModeKey {
  if (!input) return "default"

  if (input.manualModeOverride) {
    return input.manualModeOverride
  }

  const action = input.action?.trim()
  if (action === "send_team_message" || action === "send_notification") {
    return "messaging"
  }
  if (input.isMessaging || input.page?.toLowerCase() === "messaging") {
    return "messaging"
  }

  if (input.isSidelineModeEnabled) {
    return "sideline"
  }

  if (action === "create_event" || action === "move_player_depth_chart") {
    return "practice"
  }

  const page = input.page?.toLowerCase().trim()
  if (page === "calendar") {
    return "practice"
  }

  if (input.isPractice) {
    return "practice"
  }

  if (input.intent === "game_strategy" || input.isLiveGame) {
    return "game"
  }

  if (page === "playbooks") {
    return "game"
  }

  return "default"
}

/** Backward-compatible: tool/action + route + intent only. */
export function resolveVoiceMode(context: VoiceContext | undefined | null): VoiceModeKey {
  return resolveVoiceModeFromInput(fromLegacyContext(context))
}

/**
 * Full context-aware resolution (personality does not switch mode here — use profile resolver for OC text).
 */
export function resolveVoiceModeExtended(
  input: ResolveVoiceModeInput | VoiceContext | undefined | null
): VoiceModeKey {
  if (!input) return "default"
  if ("manualModeOverride" in input || "isSidelineModeEnabled" in input) {
    return resolveVoiceModeFromInput(input as ResolveVoiceModeInput)
  }
  return resolveVoiceMode(input as VoiceContext)
}
