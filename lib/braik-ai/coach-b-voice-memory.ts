import type { CoachPersonalityId } from "@/lib/config/coach-personalities"

/**
 * Durable voice/tone preferences for Coach B (user, team, or inferred later).
 * Keep fields optional so partial updates merge cleanly.
 */
export type CoachBVoicePreferenceMemory = {
  preferredPersonality?: CoachPersonalityId | null
  /** free-form tone hint merged into prompts/TTS */
  preferredTone?: string | null
  verbosity?: "minimal" | "normal" | "detailed" | null
  autoPlayResponses?: boolean | null
  /** Default for sideline UX (widget can still toggle per session). */
  sidelineModeDefault?: boolean | null
  /** hype vs calm — affects game/practice delivery hints */
  energyPreference?: "hype" | "calm" | "balanced" | null
  /** When true, polish parent-facing / external messaging tone even if personality is terse. */
  parentFacingPolished?: boolean | null
}

export const EMPTY_VOICE_MEMORY: CoachBVoicePreferenceMemory = {}

export function mergeVoiceMemory(
  base: CoachBVoicePreferenceMemory,
  overrides: CoachBVoicePreferenceMemory | null | undefined
): CoachBVoicePreferenceMemory {
  if (!overrides) return { ...base }
  return {
    ...base,
    ...overrides,
    preferredPersonality: overrides.preferredPersonality ?? base.preferredPersonality,
    verbosity: overrides.verbosity ?? base.verbosity,
    energyPreference: overrides.energyPreference ?? base.energyPreference,
  }
}
