import { COACH_B_TTS_INSTRUCTIONS } from "@/lib/config/voice"

/**
 * Situation-specific delivery layers. Default OpenAI voice stays from VOICE_CONFIG (`ash`).
 */
export const VOICE_MODES = {
  default: {
    label: "Default",
    instructions: `
Speak like a young but experienced football coach.
Confident, clear, and relatable.
Balanced tone with light motivation.
`.trim(),
  },
  practice: {
    label: "Practice",
    instructions: `
Speak like a focused position coach during practice.
Calm, clear, and instructional.
Emphasize teaching and clarity.
Keep tone steady and supportive.
`.trim(),
  },
  game: {
    label: "Game",
    instructions: `
Speak like a coach during a game.
More intense and decisive.
Short, direct commands.
Higher urgency, but controlled.
`.trim(),
  },
  sideline: {
    label: "Sideline",
    instructions: `
Sideline / live environment — ultra concise.
One short sentence when possible.
Sound urgent but controlled — like a coach in the flow of a game or practice.
No long explanations; command-style delivery.
Prioritize the immediate action or recommendation.
`.trim(),
  },
  messaging: {
    label: "Messaging",
    instructions: `
Speak in a professional and polished tone.
Clear and respectful.
Appropriate for communicating with parents or staff.
`.trim(),
  },
} as const

export type VoiceModeKey = keyof typeof VOICE_MODES

/** Minimal slice for TTS instruction merging (avoids circular imports with voice profile resolver). */
export type CoachBTtsInstructionProfile = {
  effectiveMode: VoiceModeKey
  toneInstructions: string
}

export function getVoiceModeInstructions(mode: VoiceModeKey): string {
  return VOICE_MODES[mode].instructions
}

/** @deprecated Prefer buildCoachBTtsInstructions — kept for incremental migration. */
export function buildTtsInstructionsForMode(mode: VoiceModeKey): string {
  const modeLayer = VOICE_MODES[mode].instructions
  return [COACH_B_TTS_INSTRUCTIONS, "", "Context-specific delivery:", modeLayer].join("\n")
}

/**
 * Full OpenAI TTS `instructions`: base Coach B + personality + mode + optional memory profile text.
 */
export function buildCoachBTtsInstructions(params: {
  profile: CoachBTtsInstructionProfile
  modeInstructionsOverride?: string | null
}): string {
  const modeLayer = params.modeInstructionsOverride ?? getVoiceModeInstructions(params.profile.effectiveMode)
  return [
    COACH_B_TTS_INSTRUCTIONS,
    "",
    "Personality delivery:",
    params.profile.toneInstructions,
    "",
    "Context-specific delivery:",
    modeLayer,
  ].join("\n")
}
