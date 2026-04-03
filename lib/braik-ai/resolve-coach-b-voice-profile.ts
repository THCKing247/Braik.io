import {
  COACH_PERSONALITIES,
  DEFAULT_COACH_PERSONALITY_ID,
  type CoachPersonalityId,
} from "@/lib/config/coach-personalities"
import type { VoiceModeKey } from "@/lib/config/voice-modes"
import type { CoachBVoicePreferenceMemory } from "@/lib/braik-ai/coach-b-voice-memory"

export type CoachBVoiceProfileContext = {
  /** Route hint e.g. calendar, messaging */
  page?: string
  action?: string
  intent?: string
  isMessagingSurface?: boolean
  isOffensePlayQuestion?: boolean
}

export type ResolveCoachBVoiceProfileInput = {
  userPreferences?: CoachBVoicePreferenceMemory | null
  teamPreferences?: CoachBVoicePreferenceMemory | null
  currentContext?: CoachBVoiceProfileContext | null
  /** Explicit UI or session selection */
  selectedPersonality?: CoachPersonalityId | null
  /** Effective mode after resolveVoiceMode */
  selectedMode: VoiceModeKey
  /** Session-only override — wins over stored preferredPersonality */
  personalityOverride?: CoachPersonalityId | null
}

export type CoachBVoiceProfile = {
  voice: string
  personality: CoachPersonalityId
  personalityLabel: string
  effectiveMode: VoiceModeKey
  /** For OpenAI TTS */
  toneInstructions: string
  /** For chat system prompt */
  textResponseRules: string
  verbosity: "minimal" | "normal" | "detailed"
  prefersConcise: boolean
  /** One-line summary for logs */
  summaryRules: string
}

function pickPersonality(input: ResolveCoachBVoiceProfileInput): CoachPersonalityId {
  if (input.personalityOverride) {
    return input.personalityOverride
  }
  if (input.selectedPersonality) {
    return input.selectedPersonality
  }
  if (input.userPreferences?.preferredPersonality) {
    return input.userPreferences.preferredPersonality
  }
  if (input.teamPreferences?.preferredPersonality) {
    return input.teamPreferences.preferredPersonality
  }
  return DEFAULT_COACH_PERSONALITY_ID
}

/** Tactical play questions: sharpen to OC delivery when the coach uses the default balanced persona. */
function applyOffenseQuestionOverride(
  base: CoachPersonalityId,
  ctx: CoachBVoiceProfileContext | null | undefined
): CoachPersonalityId {
  if (!ctx?.isOffensePlayQuestion) return base
  if (base === "balanced_head_coach") return "offensive_coordinator"
  return base
}

function resolveVerbosity(
  mem: CoachBVoicePreferenceMemory | null | undefined,
  mode: VoiceModeKey
): "minimal" | "normal" | "detailed" {
  const v = mem?.verbosity
  if (v === "minimal" || v === "detailed" || v === "normal") return v
  if (mode === "sideline") return "minimal"
  return "normal"
}

function memoryToneLines(mem: CoachBVoicePreferenceMemory | null | undefined): string {
  if (!mem) return ""
  const parts: string[] = []
  if (mem.preferredTone?.trim()) {
    parts.push(`User/team tone preference: ${mem.preferredTone.trim()}`)
  }
  if (mem.energyPreference === "hype") {
    parts.push("Lean slightly more energetic for game/practice moments when appropriate.")
  }
  if (mem.energyPreference === "calm") {
    parts.push("Keep delivery calm and controlled even in high-urgency moments.")
  }
  if (mem.parentFacingPolished) {
    parts.push("For parent-facing or external messaging, keep language polished and professional.")
  }
  return parts.length ? parts.join("\n") : ""
}

/**
 * Merges user + team memory, explicit selections, and context into one profile for TTS + chat.
 */
export function resolveCoachBVoiceProfile(input: ResolveCoachBVoiceProfileInput): CoachBVoiceProfile {
  const mergedMem = {
    ...input.teamPreferences,
    ...input.userPreferences,
  }

  let personality = pickPersonality(input)
  personality = applyOffenseQuestionOverride(personality, input.currentContext ?? null)

  const p = COACH_PERSONALITIES[personality]
  const verbosity = resolveVerbosity(mergedMem, input.selectedMode)
  const prefersConcise = verbosity === "minimal" || p.responseStyle.concise

  const memLines = memoryToneLines(mergedMem)
  const toneInstructions = [p.ttsInstructions.trim(), memLines ? `\n${memLines}` : ""].filter(Boolean).join("\n")

  const textResponseRules = [p.textStyleRules.trim(), memLines ? `\nMemory/preferences:\n${memLines}` : ""]
    .filter(Boolean)
    .join("\n\n")

  return {
    voice: "ash",
    personality,
    personalityLabel: p.label,
    effectiveMode: input.selectedMode,
    toneInstructions,
    textResponseRules,
    verbosity,
    prefersConcise,
    summaryRules: `${p.label} • ${input.selectedMode} • verbosity ${verbosity}`,
  }
}
