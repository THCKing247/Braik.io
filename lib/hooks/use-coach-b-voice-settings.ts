"use client"

import { useCallback, useEffect, useState } from "react"
import type { CoachPersonalityId } from "@/lib/config/coach-personalities"
import { DEFAULT_COACH_PERSONALITY_ID } from "@/lib/config/coach-personalities"
import type { CoachBVoicePreferenceMemory } from "@/lib/braik-ai/coach-b-voice-memory"

const STORAGE_KEY = "braik.coachB.voiceSettings.v1"

export type CoachBVoiceLocalSettings = {
  personalityId: CoachPersonalityId
  sidelineMode: boolean
  /**
   * Voice Mode: when true, new assistant messages automatically request TTS and play.
   * When false, no autoplay; the speaker button still works for manual playback.
   */
  voiceModeEnabled: boolean
  /**
   * @deprecated Kept for localStorage backward compatibility; mirrors `voiceModeEnabled` on save.
   */
  voiceRepliesEnabled: boolean
  /**
   * @deprecated Kept for localStorage backward compatibility; mirrors `voiceModeEnabled` on save.
   */
  autoPlayResponses: boolean
  memory: CoachBVoicePreferenceMemory
}

const DEFAULT_LOCAL: CoachBVoiceLocalSettings = {
  personalityId: DEFAULT_COACH_PERSONALITY_ID,
  sidelineMode: false,
  voiceModeEnabled: true,
  voiceRepliesEnabled: true,
  autoPlayResponses: true,
  memory: {},
}

function migrateVoiceMode(p: Partial<CoachBVoiceLocalSettings> & Record<string, unknown>): boolean {
  if (typeof p.voiceModeEnabled === "boolean") return p.voiceModeEnabled
  if (typeof p.autoPlayResponses === "boolean") return p.autoPlayResponses
  return false
}

function readStored(): CoachBVoiceLocalSettings {
  if (typeof window === "undefined") return DEFAULT_LOCAL
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LOCAL
    const p = JSON.parse(raw) as Partial<CoachBVoiceLocalSettings> & Record<string, unknown>
    const voiceModeEnabled = migrateVoiceMode(p)
    return {
      personalityId:
        p.personalityId === "balanced_head_coach" ||
        p.personalityId === "offensive_coordinator" ||
        p.personalityId === "players_coach" ||
        p.personalityId === "disciplinarian"
          ? p.personalityId
          : DEFAULT_COACH_PERSONALITY_ID,
      sidelineMode: Boolean(p.sidelineMode),
      voiceModeEnabled,
      voiceRepliesEnabled: p.voiceRepliesEnabled !== false,
      autoPlayResponses: voiceModeEnabled,
      memory: p.memory && typeof p.memory === "object" ? { ...p.memory } : {},
    }
  } catch {
    return DEFAULT_LOCAL
  }
}

export function useCoachBVoiceSettings(teamId: string) {
  const [settings, setSettings] = useState<CoachBVoiceLocalSettings>(() => DEFAULT_LOCAL)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setSettings(readStored())
    setHydrated(true)
  }, [teamId])

  const setPersonalityId = useCallback((personalityId: CoachPersonalityId) => {
    setSettings((prev) => {
      const next: CoachBVoiceLocalSettings = {
        ...prev,
        personalityId,
        memory: { ...prev.memory, preferredPersonality: personalityId },
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const setSidelineMode = useCallback((sidelineMode: boolean) => {
    setSettings((prev) => {
      const next: CoachBVoiceLocalSettings = {
        ...prev,
        sidelineMode,
        memory: { ...prev.memory, sidelineModeDefault: sidelineMode },
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const setVoiceModeEnabled = useCallback((voiceModeEnabled: boolean) => {
    setSettings((prev) => {
      const next: CoachBVoiceLocalSettings = {
        ...prev,
        voiceModeEnabled,
        autoPlayResponses: voiceModeEnabled,
        memory: { ...prev.memory, autoPlayResponses: voiceModeEnabled },
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return {
    settings,
    hydrated,
    setPersonalityId,
    setSidelineMode,
    setVoiceModeEnabled,
  }
}
