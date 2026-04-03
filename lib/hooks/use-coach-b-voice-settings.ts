"use client"

import { useCallback, useEffect, useState } from "react"
import type { CoachPersonalityId } from "@/lib/config/coach-personalities"
import { DEFAULT_COACH_PERSONALITY_ID } from "@/lib/config/coach-personalities"
import type { CoachBVoicePreferenceMemory } from "@/lib/braik-ai/coach-b-voice-memory"

const STORAGE_KEY = "braik.coachB.voiceSettings.v1"

export type CoachBVoiceLocalSettings = {
  personalityId: CoachPersonalityId
  sidelineMode: boolean
  /** Master switch for spoken playback (TTS play + auto-speak). */
  voiceRepliesEnabled: boolean
  autoPlayResponses: boolean
  memory: CoachBVoicePreferenceMemory
}

const DEFAULT_LOCAL: CoachBVoiceLocalSettings = {
  personalityId: DEFAULT_COACH_PERSONALITY_ID,
  sidelineMode: false,
  voiceRepliesEnabled: true,
  autoPlayResponses: false,
  memory: {},
}

function readStored(): CoachBVoiceLocalSettings {
  if (typeof window === "undefined") return DEFAULT_LOCAL
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LOCAL
    const p = JSON.parse(raw) as Partial<CoachBVoiceLocalSettings>
    return {
      personalityId:
        p.personalityId === "balanced_head_coach" ||
        p.personalityId === "offensive_coordinator" ||
        p.personalityId === "players_coach" ||
        p.personalityId === "disciplinarian"
          ? p.personalityId
          : DEFAULT_COACH_PERSONALITY_ID,
      sidelineMode: Boolean(p.sidelineMode),
      voiceRepliesEnabled: p.voiceRepliesEnabled !== false,
      autoPlayResponses: Boolean(p.autoPlayResponses),
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

  const setVoiceRepliesEnabled = useCallback((voiceRepliesEnabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, voiceRepliesEnabled }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const setAutoPlayResponses = useCallback((autoPlayResponses: boolean) => {
    setSettings((prev) => {
      const next: CoachBVoiceLocalSettings = {
        ...prev,
        autoPlayResponses,
        memory: { ...prev.memory, autoPlayResponses },
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
    setVoiceRepliesEnabled,
    setAutoPlayResponses,
  }
}
