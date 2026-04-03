import type { CoachPersonalityId } from "@/lib/config/coach-personalities"
import { isCoachPersonalityId } from "@/lib/config/coach-personalities"
import type { VoiceModeKey } from "@/lib/config/voice-modes"
import type { CoachBVoicePreferenceMemory } from "@/lib/braik-ai/coach-b-voice-memory"

/** Client → server Coach B voice OS fields (chat + TTS). */
export type CoachBVoiceRequestFields = {
  page?: string
  action?: string
  intent?: string
  personalityId?: CoachPersonalityId | null
  personalityOverride?: CoachPersonalityId | null
  sidelineMode?: boolean
  voiceModeOverride?: VoiceModeKey | null
  userVoiceMemory?: CoachBVoicePreferenceMemory | null
  teamVoiceMemory?: CoachBVoicePreferenceMemory | null
  voiceCommand?: {
    intentType: string
    actionName?: string
    confidence?: number
    requiresConfirmation?: boolean
  } | null
  isLiveGame?: boolean
  isPractice?: boolean
  isMessaging?: boolean
}

const VOICE_MODE_KEYS = new Set<string>(["default", "practice", "game", "sideline", "messaging"])

function trimStr(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined
  const t = v.trim()
  if (!t) return undefined
  return t.slice(0, max)
}

function parseMemory(raw: unknown): CoachBVoicePreferenceMemory | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const preferredPersonality = trimStr(o.preferredPersonality, 64)
  const out: CoachBVoicePreferenceMemory = {}
  if (preferredPersonality && isCoachPersonalityId(preferredPersonality)) {
    out.preferredPersonality = preferredPersonality
  }
  const pt = trimStr(o.preferredTone, 500)
  if (pt) out.preferredTone = pt
  const v = o.verbosity
  if (v === "minimal" || v === "normal" || v === "detailed") out.verbosity = v
  if (typeof o.autoPlayResponses === "boolean") out.autoPlayResponses = o.autoPlayResponses
  if (typeof o.sidelineModeDefault === "boolean") out.sidelineModeDefault = o.sidelineModeDefault
  const e = o.energyPreference
  if (e === "hype" || e === "calm" || e === "balanced") out.energyPreference = e
  if (typeof o.parentFacingPolished === "boolean") out.parentFacingPolished = o.parentFacingPolished
  return Object.keys(out).length ? out : undefined
}

function parseVoiceCommand(raw: unknown): CoachBVoiceRequestFields["voiceCommand"] {
  if (!raw || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const intentType = trimStr(o.intentType, 32)
  if (!intentType) return undefined
  return {
    intentType,
    actionName: trimStr(o.actionName, 64),
    confidence: typeof o.confidence === "number" ? o.confidence : undefined,
    requiresConfirmation: typeof o.requiresConfirmation === "boolean" ? o.requiresConfirmation : undefined,
  }
}

/** Safe parse from JSON body `coachVoice` field. */
export function parseCoachBVoiceRequest(raw: unknown): CoachBVoiceRequestFields | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const personalityId = trimStr(o.personalityId, 64)
  const personalityOverride = trimStr(o.personalityOverride, 64)
  const vm = trimStr(o.voiceModeOverride, 32)
  const out: CoachBVoiceRequestFields = {}
  const p = personalityId && isCoachPersonalityId(personalityId) ? personalityId : undefined
  const po = personalityOverride && isCoachPersonalityId(personalityOverride) ? personalityOverride : undefined
  if (p) out.personalityId = p
  if (po) out.personalityOverride = po
  const page = trimStr(o.page, 128)
  const action = trimStr(o.action, 128)
  const intent = trimStr(o.intent, 128)
  if (page) out.page = page
  if (action) out.action = action
  if (intent) out.intent = intent
  if (typeof o.sidelineMode === "boolean") out.sidelineMode = o.sidelineMode
  if (vm && VOICE_MODE_KEYS.has(vm)) out.voiceModeOverride = vm as VoiceModeKey
  const um = parseMemory(o.userVoiceMemory)
  const tm = parseMemory(o.teamVoiceMemory)
  if (um) out.userVoiceMemory = um
  if (tm) out.teamVoiceMemory = tm
  const vc = parseVoiceCommand(o.voiceCommand)
  if (vc) out.voiceCommand = vc
  if (typeof o.isLiveGame === "boolean") out.isLiveGame = o.isLiveGame
  if (typeof o.isPractice === "boolean") out.isPractice = o.isPractice
  if (typeof o.isMessaging === "boolean") out.isMessaging = o.isMessaging
  return Object.keys(out).length ? out : undefined
}
