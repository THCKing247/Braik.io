"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageSquare, X, Send, Upload, Sparkles, File, AlertTriangle, Mic, Loader2, Volume2 } from "lucide-react"
import { AIActionConfirmation } from "@/components/ai/ai-action-confirmation"
import { useCoachB } from "@/components/portal/coach-b-context"
import { cn } from "@/lib/utils"
import { trackProductEvent } from "@/lib/utils/analytics-client"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"
import { MobileFab } from "@/components/mobile/mobile-fab"
import { useCoachBRotatingCopy } from "@/lib/hooks/use-coach-b-rotating-copy"
import { inferPageFromPathname } from "@/lib/braik-ai/resolve-voice-mode"
import { classifyVoiceCommand } from "@/lib/braik-ai/voice-command-classifier"
import { getCoachBNavigationHref, navigationActionLabel } from "@/lib/braik-ai/coach-b-voice-navigation"
import { useCoachBVoiceSettings } from "@/lib/hooks/use-coach-b-voice-settings"
import { COACH_PERSONALITIES, type CoachPersonalityId } from "@/lib/config/coach-personalities"
import type { CoachBVoiceRequestFields } from "@/lib/braik-ai/coach-b-voice-request"
import {
  BRAIK_CALENDAR_EVENTS_CHANGED_EVENT,
  defaultCalendarWeekRange,
  fetchCalendarEventsJson,
  toCalendarRangeIso,
} from "@/lib/calendar/calendar-events-client"
import { getClientSchedulingContext } from "@/lib/calendar/client-scheduling-context"
import { resolveCoachBVoiceClientMessage } from "@/lib/braik-ai/coach-b-voice-api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  /** Short line for TTS when Voice Mode is on (server-generated or derived). */
  spokenText?: string
  timestamp: Date
  /** Voice transcript user bubble */
  source?: "voice_transcript"
  type?: "response" | "action_proposal" | "action_executed" | "error"
  proposalId?: string
  actionType?: string
  usage?: {
    tokensUsed: number
    rawTokens: number
    roleWeight: number
  }
  usageStatus?: {
    tokensUsed: number
    tokensLimit: number
    usagePercentage: number
    mode: "full" | "suggestion_only" | "disabled"
  }
}

interface AIChatbotWidgetProps {
  teamId: string
  userRole: string
  primaryColor?: string
}

/** Above this length, send spokenSummary: 1–2 sentences for voice; full text stays in chat only. */
const TTS_SUMMARY_ABOVE_CHARS = 320
const TTS_SPOKEN_SUMMARY_MAX_CHARS = 380

function takeFirstSentences(text: string, maxSentences: number): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  const split = normalized.split(/(?<=[.!?])\s+/)
  const parts = split.length ? split : [normalized]
  const joined = parts
    .filter(Boolean)
    .slice(0, maxSentences)
    .join(" ")
    .trim()
  return joined || normalized.slice(0, TTS_SPOKEN_SUMMARY_MAX_CHARS)
}

function deriveSpokenPayload(
  full: string,
  opts?: { sidelineMode?: boolean }
): { text: string; spokenSummary?: string } {
  const t = full.trim()
  const sideline = Boolean(opts?.sidelineMode)
  const threshold = sideline ? 120 : TTS_SUMMARY_ABOVE_CHARS
  const maxSummaryChars = sideline ? 220 : TTS_SPOKEN_SUMMARY_MAX_CHARS
  if (t.length <= threshold && !sideline) return { text: t }
  if (sideline && t.length <= maxSummaryChars) return { text: t }

  let summary = takeFirstSentences(t, sideline ? 1 : 2)
  if (summary.length > maxSummaryChars) {
    summary = `${summary.slice(0, maxSummaryChars - 1)}…`
  }
  if (!sideline && summary.length >= t.length * 0.95) {
    const cut = t.slice(0, 280).trimEnd()
    const lastSpace = cut.lastIndexOf(" ")
    summary = `${(lastSpace > 200 ? cut.slice(0, lastSpace) : cut)}…`
  }

  return {
    text: t,
    spokenSummary: `${summary} Full answer is in the chat.`,
  }
}

function buildCoachVoiceFields(args: {
  pathname: string | null
  isPlayEditorRoute: boolean
  personalityId: CoachPersonalityId
  sidelineMode: boolean
  memory: CoachBVoiceRequestFields["userVoiceMemory"]
  voiceCommand?: CoachBVoiceRequestFields["voiceCommand"]
}): CoachBVoiceRequestFields {
  const page = inferPageFromPathname(args.pathname)
  const isMessaging = args.pathname?.toLowerCase().includes("message") ?? false
  return {
    page,
    ...(args.isPlayEditorRoute ? { intent: "game_strategy" as const } : {}),
    personalityId: args.personalityId,
    sidelineMode: args.sidelineMode,
    userVoiceMemory: args.memory ?? undefined,
    isMessaging,
    ...(args.voiceCommand ? { voiceCommand: args.voiceCommand } : {}),
  }
}

/** Discard very short press-and-hold clips (noise / accidental tap). */
const MIN_VOICE_MS = 450
const MIN_VOICE_BYTES = 800

export function AIChatbotWidget({ teamId, userRole, primaryColor = "#3B82F6" }: AIChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canUseAdvancedActions = userRole === "HEAD_COACH" || userRole === "ASSISTANT_COACH"
  const coachCopy = useCoachBRotatingCopy()
  const coachB = useCoachB()
  const pathname = usePathname()
  const router = useRouter()
  const isPlayEditorRoute = pathname?.startsWith("/dashboard/playbooks/play/") ?? false
  const [feedbackVoted, setFeedbackVoted] = useState<Set<string>>(() => new Set())
  const { settings: voiceSettings, hydrated: voiceSettingsHydrated, setPersonalityId, setSidelineMode, setVoiceModeEnabled } =
    useCoachBVoiceSettings(teamId)
  /** Bumps when a new TTS request starts; stale fetches discard audio. */
  const ttsSessionRef = useRef(0)
  /** Prevents duplicate autoplay (e.g. React Strict Mode double effect) for the same message id. */
  const lastAutoplayScheduledIdRef = useRef<string | null>(null)
  const [voicePhase, setVoicePhase] = useState<"idle" | "arming" | "recording" | "processing">("idle")
  /** True while pointer is down but left the mic button (release will cancel). */
  const [voiceDragCancel, setVoiceDragCancel] = useState(false)
  /** Short-lived status: canceled clip, too short, permission, etc. */
  const [voiceInputHint, setVoiceInputHint] = useState<string | null>(null)
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micAbortControllerRef = useRef<AbortController | null>(null)
  const isMicPressingRef = useRef(false)
  const micCancelDragRef = useRef(false)
  const recordingStartedAtRef = useRef<number>(0)
  const micGlobalCleanupRef = useRef<(() => void) | null>(null)
  const voiceHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const lastRequestIdempotencyRef = useRef<string | null>(null)
  const coachBAudioRef = useRef<HTMLAudioElement | null>(null)
  const prevMessagesLenRef = useRef(0)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const voicePhaseRef = useRef(voicePhase)
  useEffect(() => {
    voicePhaseRef.current = voicePhase
  }, [voicePhase])

  // When dashboard sidebar is shown (desktop), register open so "Ask Coach B" in sidebar opens this widget; hide floating button.
  useEffect(() => {
    coachB?.registerOpen(() => setIsOpen(true))
  }, [coachB])

  useEffect(() => {
    if (!isOpen) return
    trackProductEvent(BRAIK_EVENTS.coach_b.opened, {
      teamId,
      eventCategory: "coach_b",
      metadata: { surface: isPlayEditorRoute ? "play_editor" : "dashboard_widget" },
    })
  }, [isOpen, teamId, isPlayEditorRoute])

  const sendCoachBHelpfulness = async (messageId: string, helpful: boolean) => {
    if (feedbackVoted.has(messageId)) return
    try {
      const res = await fetch("/api/ai/coach-b-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, helpful, featureArea: "chat_widget" }),
      })
      if (res.ok) {
        setFeedbackVoted((prev) => new Set(prev).add(messageId))
      }
    } catch {
      /* non-blocking */
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const playAssistantTts = useCallback(
    async (
      messageId: string,
      content: string,
      opts?: { actionType?: string; source?: "autoplay" | "manual"; spokenText?: string }
    ) => {
      if (!voiceSettingsHydrated) return
      if (opts?.source === "autoplay" && !voiceSettings.voiceModeEnabled) return

      const mySession = ++ttsSessionRef.current
      setTtsError(null)
      setTtsLoadingId(messageId)

      const revokeIfStale = (url: string | null) => {
        if (url) URL.revokeObjectURL(url)
      }

      try {
        coachBAudioRef.current?.pause()
        coachBAudioRef.current = null

        const spoken = opts?.spokenText?.trim()
        /** Voice: synthesize from short line only — avoids long UI text in TTS and cuts latency. */
        const payload = spoken
          ? { text: spoken, spokenSummary: spoken }
          : deriveSpokenPayload(content, { sidelineMode: voiceSettings.sidelineMode })
        const coachVoice = buildCoachVoiceFields({
          pathname,
          isPlayEditorRoute,
          personalityId: voiceSettings.personalityId,
          sidelineMode: voiceSettings.sidelineMode,
          memory: voiceSettings.memory,
        })
        const context = {
          page: inferPageFromPathname(pathname),
          ...(opts?.actionType ? { action: opts.actionType } : {}),
          ...(isPlayEditorRoute ? { intent: "game_strategy" as const } : {}),
        }
        const res = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            text: payload.text,
            ...(payload.spokenSummary ? { spokenSummary: payload.spokenSummary } : {}),
            context,
            coachVoice,
          }),
        })

        if (mySession !== ttsSessionRef.current) return

        if (!res.ok) {
          const errBody = await res.text().catch(() => "")
          console.warn("[Coach B TTS] request failed", res.status, errBody)
          setTtsError("Couldn't load audio. Tap the speaker to try again.")
          return
        }

        const blob = await res.blob()
        if (mySession !== ttsSessionRef.current) return

        const url = URL.createObjectURL(blob)
        if (mySession !== ttsSessionRef.current) {
          revokeIfStale(url)
          return
        }

        const audio = new Audio(url)
        if (voiceSettings.sidelineMode) {
          audio.playbackRate = 1.12
        }
        coachBAudioRef.current = audio
        audio.onended = () => {
          revokeIfStale(url)
          if (coachBAudioRef.current === audio) coachBAudioRef.current = null
        }

        try {
          await audio.play()
        } catch (playErr: unknown) {
          revokeIfStale(url)
          coachBAudioRef.current = null
          const name = playErr && typeof playErr === "object" && "name" in playErr ? (playErr as { name?: string }).name : ""
          if (name === "NotAllowedError" || name === "NotSupportedError") {
            if (opts?.source === "autoplay") {
              setTtsError("Autoplay was blocked by the browser. Tap the speaker to listen.")
            } else {
              setTtsError("Playback was blocked. Try again or check browser permissions.")
            }
            return
          }
          console.warn("[Coach B TTS] playback error", playErr)
          setTtsError("Couldn't play audio. Tap the speaker to try again.")
        }
      } catch (e) {
        if (mySession === ttsSessionRef.current) {
          console.warn("[Coach B TTS] error", e)
          setTtsError("Couldn't play audio. Tap the speaker to try again.")
        }
      } finally {
        setTtsLoadingId((id) => (id === messageId ? null : id))
      }
    },
    [teamId, pathname, isPlayEditorRoute, voiceSettings, voiceSettingsHydrated]
  )

  /** Voice Mode: auto-request TTS when a new assistant message is appended (not when toggling settings). */
  useEffect(() => {
    const len = messages.length
    if (len === 0) {
      prevMessagesLenRef.current = 0
      return
    }
    const grew = len > prevMessagesLenRef.current
    prevMessagesLenRef.current = len
    if (!grew || !voiceSettingsHydrated || !voiceSettings.voiceModeEnabled) return
    const last = messages[len - 1]
    if (last.role !== "assistant" || last.type === "error") return
    if (lastAutoplayScheduledIdRef.current === last.id) return
    lastAutoplayScheduledIdRef.current = last.id
    void playAssistantTts(last.id, last.content, {
      actionType: last.actionType,
      source: "autoplay",
      spokenText: last.spokenText,
    })
  }, [messages, voiceSettingsHydrated, voiceSettings.voiceModeEnabled, playAssistantTts])

  useEffect(() => {
    return () => {
      coachBAudioRef.current?.pause()
      coachBAudioRef.current = null
    }
  }, [])

  const CONFIRM_RE = /^(yes|yeah|yep|sure|ok|okay|send it|confirm|go ahead|do it)\b/i
  const REJECT_RE = /^(no|nope|nah|cancel|stop|never mind|don'?t|skip)\b/i

  /** Same Coach B pipeline as typed chat; used after voice transcription. */
  const callCoachBChat = async (opts: {
    message: string
    conversationHistory: Array<{ role: string; content: string }>
    inputSource: "text" | "voice"
    confirmProposalId?: string
    voiceCommand?: CoachBVoiceRequestFields["voiceCommand"]
  }) => {
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    lastRequestIdempotencyRef.current = idempotencyKey

    const coachVoice = buildCoachVoiceFields({
      pathname,
      isPlayEditorRoute,
      personalityId: voiceSettings.personalityId,
      sidelineMode: voiceSettings.sidelineMode,
      memory: voiceSettings.memory,
      voiceCommand: opts.voiceCommand,
    })

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        role: userRole,
        message: opts.message,
        conversationHistory: opts.conversationHistory,
        inputSource: opts.inputSource,
        confirmProposalId: opts.confirmProposalId,
        idempotencyKey,
        enableActionTools: true,
        coachVoice,
        schedulingContext: getClientSchedulingContext(),
      }),
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: response.ok, data }
  }

  const applyCoachBResponse = (data: Record<string, unknown>) => {
    const t = data.type
    const bumpAutoplayAndSpeak = (msg: Message) => {
      const st = msg.spokenText?.trim()
      if (!voiceSettingsHydrated || !voiceSettings.voiceModeEnabled || !st) return
      lastAutoplayScheduledIdRef.current = msg.id
      void playAssistantTts(msg.id, msg.content, {
        source: "autoplay",
        spokenText: st,
        actionType: msg.actionType,
      })
    }

    if (t === "action_proposal") {
      const proposalMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: (typeof data.message === "string" && data.message) || "An action requires your approval.",
        timestamp: new Date(),
        type: "action_proposal",
        proposalId: typeof data.proposalId === "string" ? data.proposalId : undefined,
        actionType: typeof data.actionType === "string" ? data.actionType : undefined,
      }
      setMessages((prev) => [...prev, proposalMessage])
      if (typeof data.proposalId === "string") setActiveProposalId(data.proposalId)
      return
    }
    if (t === "action_executed") {
      setActiveProposalId(null)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: (typeof data.response === "string" && data.response) || "Action completed.",
        ...(typeof data.spokenText === "string" && data.spokenText.trim()
          ? { spokenText: data.spokenText.trim() }
          : {}),
        timestamp: new Date(),
        type: "action_executed",
        actionType:
          data.result && typeof data.result === "object" && data.result !== null && "eventId" in data.result
            ? "create_event"
            : undefined,
      }
      const calTid = typeof data.calendarRefreshTeamId === "string" ? data.calendarRefreshTeamId.trim() : ""
      if (calTid) {
        window.dispatchEvent(new CustomEvent(BRAIK_CALENDAR_EVENTS_CHANGED_EVENT, { detail: { teamId: calTid } }))
      }
      if (process.env.NODE_ENV === "development" && calTid && data.result && typeof data.result === "object" && data.result !== null) {
        const evId = "eventId" in data.result && typeof (data.result as { eventId?: unknown }).eventId === "string" ? (data.result as { eventId: string }).eventId : ""
        if (evId) {
          const range = defaultCalendarWeekRange()
          const { from, to } = toCalendarRangeIso(range.start, range.end)
          void fetchCalendarEventsJson(calTid, from, to)
            .then((rows) => {
              console.log("[Coach B calendar] post-create refetch check", {
                teamId: calTid,
                eventId: evId,
                eventCount: rows.length,
                eventPresent: rows.some((r) => r.id === evId),
              })
            })
            .catch(() => {
              /* dev-only */
            })
        }
      }
      bumpAutoplayAndSpeak(assistantMessage)
      setMessages((prev) => [...prev, assistantMessage])
      return
    }
    if (data.error && typeof data.error === "string") {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.error,
        timestamp: new Date(),
        type: "error",
      }
      setMessages((prev) => [...prev, errorMessage])
      return
    }
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content:
        (typeof data.response === "string" && data.response) || "I'm sorry, I couldn't process that request.",
      ...(typeof data.spokenText === "string" && data.spokenText.trim()
        ? { spokenText: data.spokenText.trim() }
        : {}),
      timestamp: new Date(),
      type: (t as Message["type"]) || "response",
      usage: data.usage as Message["usage"],
      usageStatus: data.usageStatus as Message["usageStatus"],
    }
    bumpAutoplayAndSpeak(assistantMessage)
    setMessages((prev) => [...prev, assistantMessage])
    if (data.clearActiveProposal === true) setActiveProposalId(null)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const outgoing = input.trim()
    const confirmProposalId =
      activeProposalId && (CONFIRM_RE.test(outgoing) || REJECT_RE.test(outgoing)) ? activeProposalId : undefined
    const historyForApi = messages.map((m) => ({ role: m.role, content: m.content }))

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: outgoing,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const { ok, data } = await callCoachBChat({
        message: outgoing,
        conversationHistory: historyForApi,
        inputSource: "text",
        confirmProposalId,
      })

      if (!ok) {
        const err =
          typeof data.error === "string" ? data.error : "Sorry, I couldn't get a response. Please try again."
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: err,
            timestamp: new Date(),
            type: "error",
          },
        ])
        return
      }

      applyCoachBResponse(data)
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const sendVoiceBlob = async (blob: Blob) => {
    const priorMessages = messages
    setVoicePhase("processing")
    setLoading(true)

    const formData = new FormData()
    formData.append("audio", blob, "recording.webm")
    formData.append("teamId", teamId)

    try {
      const voiceRes = await fetch("/api/ai/voice", {
        method: "POST",
        body: formData,
        signal:
          typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
            ? AbortSignal.timeout(28000)
            : undefined,
      })
      const voiceData = (await voiceRes.json().catch(() => ({}))) as Record<string, unknown>

      if (!voiceRes.ok) {
        const errText = resolveCoachBVoiceClientMessage(voiceRes.status, voiceData)
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: errText,
            timestamp: new Date(),
            type: "error",
          },
        ])
        return
      }

      const transcript = typeof voiceData.transcript === "string" ? voiceData.transcript.trim() : ""
      if (!transcript) {
        const err =
          typeof voiceData.error === "string"
            ? voiceData.error
            : "No speech detected. Try again or type your message."
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: err,
            timestamp: new Date(),
            type: "error",
          },
        ])
        return
      }

      const classification = classifyVoiceCommand(transcript, { pathname: pathname ?? undefined, teamId })
      console.log("[Coach B Voice OS] transcript", {
        charCount: transcript.length,
        intentType: classification.intentType,
        actionName: classification.actionName ?? null,
        confidence: classification.confidence,
      })

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: transcript,
        timestamp: new Date(),
        source: "voice_transcript",
      }
      setMessages((prev) => [...prev, userMessage])

      if (
        classification.intentType === "navigation" &&
        classification.confidence >= 0.65 &&
        classification.actionName
      ) {
        const href = getCoachBNavigationHref(teamId, classification.actionName)
        if (href) {
          router.push(href)
          const ack: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: navigationActionLabel(classification.actionName),
            timestamp: new Date(),
            type: "response",
          }
          setMessages((prev) => [...prev, ack])
          return
        }
      }

      const historyForApi = priorMessages.map((m) => ({ role: m.role, content: m.content }))
      const confirmProposalId =
        activeProposalId && (CONFIRM_RE.test(transcript) || REJECT_RE.test(transcript))
          ? activeProposalId
          : undefined

      const voiceCommand =
        classification.intentType === "chat"
          ? undefined
          : {
              intentType: classification.intentType,
              actionName: classification.actionName,
              confidence: classification.confidence,
              requiresConfirmation: classification.requiresConfirmation,
            }

      const { ok, data } = await callCoachBChat({
        message: transcript,
        conversationHistory: historyForApi,
        inputSource: "voice",
        confirmProposalId,
        voiceCommand,
      })

      if (!ok) {
        const err =
          typeof data.error === "string" ? data.error : "Coach B couldn't process that. Please try again."
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: err,
            timestamp: new Date(),
            type: "error",
          },
        ])
        return
      }

      applyCoachBResponse(data)
    } catch (voiceErr) {
      const isAbort =
        voiceErr instanceof DOMException
          ? voiceErr.name === "AbortError" || voiceErr.name === "TimeoutError"
          : voiceErr instanceof Error && voiceErr.name === "AbortError"
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: isAbort
            ? resolveCoachBVoiceClientMessage(504, {})
            : "Voice processing failed. Please try again.",
          timestamp: new Date(),
          type: "error",
        },
      ])
    } finally {
      setVoicePhase("idle")
      setLoading(false)
    }
  }

  const flashVoiceHint = useCallback((msg: string) => {
    if (voiceHintTimeoutRef.current) clearTimeout(voiceHintTimeoutRef.current)
    setVoiceInputHint(msg)
    voiceHintTimeoutRef.current = setTimeout(() => {
      setVoiceInputHint(null)
      voiceHintTimeoutRef.current = null
    }, 4500)
  }, [])

  const endMicPress = useCallback(() => {
    if (!isMicPressingRef.current) return
    isMicPressingRef.current = false
    setVoiceDragCancel(false)
    micGlobalCleanupRef.current?.()
    micGlobalCleanupRef.current = null

    micAbortControllerRef.current?.abort()
    micAbortControllerRef.current = null

    const mr = mediaRecorderRef.current
    if (mr) {
      if (mr.state === "recording") {
        try {
          mr.stop()
        } catch {
          /* onstop may still run */
        }
      } else {
        micStreamRef.current?.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
        mediaRecorderRef.current = null
        setVoicePhase("idle")
      }
    } else {
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
      setVoicePhase("idle")
    }
  }, [])

  const attachGlobalPointerEnd = useCallback(() => {
    const onEnd = () => {
      endMicPress()
    }
    window.addEventListener("pointerup", onEnd, true)
    window.addEventListener("pointercancel", onEnd, true)
    micGlobalCleanupRef.current = () => {
      window.removeEventListener("pointerup", onEnd, true)
      window.removeEventListener("pointercancel", onEnd, true)
    }
  }, [endMicPress])

  const startMicRecording = async () => {
    if (loading || uploading) return
    micAbortControllerRef.current?.abort()
    const ac = new AbortController()
    micAbortControllerRef.current = ac
    setVoicePhase("arming")
    setVoiceInputHint(null)

    let mimeType = "audio/webm"

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        signal: ac.signal,
      } as MediaStreamConstraints & { signal: AbortSignal })
      micStreamRef.current = stream

      if (!isMicPressingRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
        setVoicePhase("idle")
        return
      }

      mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4"

      const mr = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
        mediaRecorderRef.current = null
        const parts = audioChunksRef.current
        audioChunksRef.current = []
        const blob = new Blob(parts, { type: mr.mimeType || mimeType })
        const durationMs = Date.now() - recordingStartedAtRef.current

        if (micCancelDragRef.current) {
          micCancelDragRef.current = false
          setVoiceDragCancel(false)
          setVoicePhase("idle")
          flashVoiceHint("Recording canceled.")
          return
        }
        if (durationMs < MIN_VOICE_MS || blob.size < MIN_VOICE_BYTES) {
          setVoicePhase("idle")
          flashVoiceHint("Too short — hold the mic a bit longer.")
          return
        }
        void sendVoiceBlob(blob)
      }

      if (!isMicPressingRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
        setVoicePhase("idle")
        return
      }

      recordingStartedAtRef.current = Date.now()
      mr.start(100)
      mediaRecorderRef.current = mr
      setVoicePhase("recording")
    } catch (e: unknown) {
      micStreamRef.current = null
      mediaRecorderRef.current = null
      setVoicePhase("idle")
      const err = e as { name?: string }
      if (err.name === "AbortError") return
      const msg =
        err.name === "NotAllowedError"
          ? "Microphone permission is required for voice input."
          : "Microphone unavailable. Check your device settings."
      flashVoiceHint(msg)
    }
  }

  const handleMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    if (isMicPressingRef.current) return
    if (loading || uploading || voicePhaseRef.current === "processing") return
    if (voicePhaseRef.current === "arming" || voicePhaseRef.current === "recording") return
    e.preventDefault()
    isMicPressingRef.current = true
    micCancelDragRef.current = false
    setVoiceDragCancel(false)
    attachGlobalPointerEnd()
    void startMicRecording()
  }

  const handleMicPointerLeave = () => {
    if (!isMicPressingRef.current) return
    micCancelDragRef.current = true
    setVoiceDragCancel(true)
  }

  const handleMicPointerEnter = () => {
    if (!isMicPressingRef.current) return
    micCancelDragRef.current = false
    setVoiceDragCancel(false)
  }

  useEffect(() => {
    return () => {
      micAbortControllerRef.current?.abort()
      micGlobalCleanupRef.current?.()
      const mr = mediaRecorderRef.current
      if (mr && mr.state === "recording") {
        try {
          mr.stop()
        } catch {
          /* ignore */
        }
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (voiceHintTimeoutRef.current) clearTimeout(voiceHintTimeoutRef.current)
    }
  }, [])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("teamId", teamId)

      const response = await fetch("/api/ai/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload file")
      }

      const data = await response.json()
      
      const uploadMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: `Uploaded file: ${file.name}`,
        timestamp: new Date(),
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.extractedText || "File uploaded successfully. AI parsing will be available when OpenAI is configured.",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, uploadMessage, aiResponse])
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sorry, I encountered an error uploading the file. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const isMobileLayout = !coachB?.isDesktop

  return (
    <>
      {isMobileLayout && !isOpen && (
        <MobileFab
          immersive={isPlayEditorRoute}
          aria-label="Open Coach B"
          onClick={() => setIsOpen(true)}
          className="border-2 border-[#0B2A5B] bg-[#3B82F6] text-white shadow-xl hover:bg-[#2563EB]"
        >
          <Sparkles className="h-7 w-7" aria-hidden />
        </MobileFab>
      )}
      {/* Chat panel: sidebar / More sheet opens via coachB.registerOpen */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 flex h-[min(600px,85vh)] flex-col overflow-hidden rounded-xl border-2 border-[#0B2A5B] bg-white shadow-2xl min-h-0",
            isMobileLayout
              ? cn(
                  "left-3 right-3 w-auto max-w-none sm:left-6 sm:right-auto sm:w-[min(24rem,calc(100vw-3rem))] sm:max-w-[calc(100vw-3rem)]",
                  isPlayEditorRoute
                    ? "bottom-[max(1rem,env(safe-area-inset-bottom,0px)+0.75rem)]"
                    : "bottom-[max(1rem,calc(var(--mobile-main-pad-bottom)+0.5rem))]"
                )
              : "bottom-6 right-6 w-[min(24rem,calc(100vw-20rem))] max-w-[calc(100vw-2rem)]"
          )}
        >
          <Card className="flex flex-col flex-1 min-h-0 overflow-hidden border-0 shadow-none bg-white">
            <CardHeader className="shrink-0 rounded-t-xl bg-[#3B82F6] text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-athletic uppercase text-white">
                  <Sparkles className="h-5 w-5 text-white" />
                  Coach B
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg hover:bg-white/20 text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 min-h-0 overflow-hidden p-0 bg-white">
              {/* Messages: takes remaining space, scrolls vertically */}
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-3 scroll-smooth bg-white"
              >
                {messages.length === 0 && (
                  <div className="text-center py-12 text-[rgb(var(--text))]">
                    <Sparkles className="h-16 w-16 mx-auto mb-4 text-[#3B82F6]" />
                    <p className="text-sm font-medium mb-2 text-[rgb(var(--text))]">
                      Hi! I'm Coach B. Ask me about your team, schedule, or get help with
                      tasks.
                    </p>
                    {canUseAdvancedActions ? (
                      <p className="text-xs mt-2 text-[rgb(var(--text2))]">
                        I can help you create events, send messages, and manage your team.
                      </p>
                    ) : (
                      <p className="text-xs mt-2 text-[rgb(var(--text2))]">
                        I can answer questions about your schedule and team updates.
                      </p>
                    )}
                  </div>
                )}
                {messages.map((message) => (
                  <div key={message.id}>
                    <div
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed ${
                          message.role === "user"
                            ? "shadow-md"
                            : message.type === "error"
                            ? "bg-danger/10 text-danger border-2 border-danger/20"
                            : message.type === "action_proposal"
                            ? "bg-amber-50 text-gray-900 border border-amber-200"
                            : message.type === "action_executed"
                            ? "bg-emerald-50 text-gray-900 border border-emerald-200"
                            : "bg-white text-[#111827] border border-[#dbe3f0] shadow-sm"
                        }`}
                        style={
                          message.role === "user"
                            ? { backgroundColor: "#3B82F6", color: "#FFFFFF" }
                            : undefined
                        }
                      >
                        {message.type === "action_proposal" && (
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-xs font-semibold text-amber-700">Action Requires Approval</span>
                          </div>
                        )}
                        {message.source === "voice_transcript" && (
                          <p className="text-[10px] uppercase tracking-wide opacity-80 mb-1">Voice transcript</p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        {message.role === "assistant" && message.type !== "error" && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void playAssistantTts(message.id, message.content, {
                                  actionType: message.actionType,
                                  source: "manual",
                                  spokenText: message.spokenText,
                                })
                              }
                              disabled={ttsLoadingId === message.id || !voiceSettingsHydrated}
                              className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                              title="Play aloud"
                              aria-label="Play message aloud"
                            >
                              {ttsLoadingId === message.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Volume2 className="h-4 w-4" aria-hidden />
                              )}
                            </button>
                          </div>
                        )}
                        {message.usage && (
                          <p className="text-xs mt-2 text-gray-500">
                            Tokens: {message.usage.tokensUsed} (weighted) • {message.usage.rawTokens} raw
                          </p>
                        )}
                        {message.role === "assistant" &&
                          message.type !== "error" &&
                          message.type !== "action_proposal" && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
                              <span className="text-[11px] text-gray-500">Was this helpful?</span>
                              <button
                                type="button"
                                disabled={feedbackVoted.has(message.id)}
                                onClick={() => void sendCoachBHelpfulness(message.id, true)}
                                className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                disabled={feedbackVoted.has(message.id)}
                                onClick={() => void sendCoachBHelpfulness(message.id, false)}
                                className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                              >
                                No
                              </button>
                            </div>
                          )}
                        {message.usageStatus && (
                          <p className="text-xs mt-1 text-gray-500">
                            Usage: {message.usageStatus.usagePercentage.toFixed(1)}% • Mode: {message.usageStatus.mode}
                          </p>
                        )}
                        <p className="text-xs mt-2 text-gray-500">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    {/* Show confirmation UI for action proposals */}
                    {message.type === "action_proposal" && message.proposalId && activeProposalId === message.proposalId && (
                      <div className="mt-4">
                        <AIActionConfirmation
                          proposalId={message.proposalId}
                          teamId={teamId}
                          onConfirmed={(detail) => {
                            setActiveProposalId(null)
                            router.refresh()
                            const successMessage: Message = {
                              id: Date.now().toString(),
                              role: "assistant",
                              content: detail.message,
                              timestamp: new Date(),
                              type: "action_executed",
                            }
                            setMessages((prev) => [...prev, successMessage])
                          }}
                          onRejected={() => {
                            setActiveProposalId(null)
                            // Add rejection message
                            const rejectionMessage: Message = {
                              id: Date.now().toString(),
                              role: "assistant",
                              content: "Action proposal rejected.",
                              timestamp: new Date(),
                              type: "response",
                            }
                            setMessages((prev) => [...prev, rejectionMessage])
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                      </div>
                      <span className="text-xs text-gray-600">Coach B is thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area: pinned to bottom */}
              <div className="shrink-0 relative border-t border-[#dbe3f0] p-4 bg-white">
                <details className="mb-2 rounded-md border border-gray-200 bg-gray-50/80 px-2 py-1.5 text-xs text-gray-700">
                  <summary className="cursor-pointer select-none font-medium text-gray-800">Coach and voice</summary>
                  <div className="mt-2 flex flex-col gap-2 pb-1">
                    <label className="flex flex-col gap-0.5 cursor-pointer select-none">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={voiceSettings.voiceModeEnabled}
                          onChange={(e) => {
                            setVoiceModeEnabled(e.target.checked)
                            setTtsError(null)
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="font-medium text-gray-800">Voice Mode</span>
                      </span>
                      <span className="pl-6 text-[11px] text-gray-500 leading-snug">
                        When on, new replies speak automatically. Turn off to read only; tap the speaker anytime to listen.
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={voiceSettings.sidelineMode}
                        onChange={(e) => setSidelineMode(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Sideline mode (short answers, faster voice)
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-gray-600">Coach style</span>
                      <select
                        value={voiceSettings.personalityId}
                        onChange={(e) => setPersonalityId(e.target.value as CoachPersonalityId)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                      >
                        {(Object.keys(COACH_PERSONALITIES) as CoachPersonalityId[]).map((id) => (
                          <option key={id} value={id}>
                            {COACH_PERSONALITIES[id].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </details>
                <div className="flex flex-col gap-2 mb-2">
                  {canUseAdvancedActions && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-600 min-h-[1.25rem]">
                      {voicePhase === "processing" && (
                        <>
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#0B2A5B]" aria-hidden />
                          <span>Transcribing…</span>
                        </>
                      )}
                      {voicePhase === "arming" && (
                        <span className="text-gray-500">Starting microphone…</span>
                      )}
                      {voicePhase === "recording" && !voiceDragCancel && (
                        <span className="font-medium text-red-600">Recording…</span>
                      )}
                      {voicePhase === "recording" && voiceDragCancel && (
                        <span className="font-medium text-amber-700">Release to cancel</span>
                      )}
                      {voicePhase === "idle" && <span className="text-gray-400">Hold the mic to speak</span>}
                    </div>
                  )}
                </div>
                {voiceInputHint && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2" role="status">
                    {voiceInputHint}
                  </p>
                )}
                {ttsError && (
                  <p className="text-xs text-red-600 mb-2" role="status">
                    {ttsError}
                  </p>
                )}
                <div className="flex gap-2 mb-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={loading || uploading || voicePhase === "recording" || voicePhase === "arming"}
                    className="flex-1"
                  />
                  {canUseAdvancedActions && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="ai-file-upload"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || uploading || voicePhase === "recording" || voicePhase === "arming"}
                        title="Upload file (Excel, CSV, PDF, Image)"
                        className="rounded-lg border-2"
                        style={{ borderColor: "#0B2A5B", color: "#0B2A5B" }}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {canUseAdvancedActions && (
                    <button
                      type="button"
                      onPointerDown={handleMicPointerDown}
                      onPointerLeave={handleMicPointerLeave}
                      onPointerEnter={handleMicPointerEnter}
                      disabled={loading || uploading || voicePhase === "processing"}
                      className={cn(
                        "inline-flex shrink-0 items-center justify-center rounded-lg border-2 transition-colors",
                        voiceSettings.sidelineMode ? "h-12 w-12 lg:h-14 lg:w-14" : "h-9 w-9",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B2A5B]",
                        voicePhase === "processing" && "ring-2 ring-amber-400 ring-offset-1",
                        voicePhase === "recording"
                          ? "border-red-600 bg-red-50 text-red-600 shadow-inner ring-2 ring-red-200"
                          : voicePhase === "arming"
                            ? "border-[#0B2A5B] bg-blue-50 text-[#0B2A5B]"
                            : "border-[#0B2A5B] text-[#0B2A5B] hover:bg-blue-50/80 active:bg-blue-100"
                      )}
                      style={{ touchAction: "none", userSelect: "none" }}
                      title="Hold to talk"
                      aria-label="Hold to record a voice message"
                    >
                      {voicePhase === "processing" ? (
                        <Loader2 className={voiceSettings.sidelineMode ? "h-6 w-6 animate-spin" : "h-4 w-4 animate-spin"} aria-hidden />
                      ) : (
                        <Mic className={voiceSettings.sidelineMode ? "h-6 w-6" : "h-4 w-4"} aria-hidden />
                      )}
                    </button>
                  )}
                  <Button
                    onClick={handleSend}
                    disabled={
                      loading ||
                      uploading ||
                      !input.trim() ||
                      voicePhase === "recording" ||
                      voicePhase === "arming"
                    }
                    size="sm"
                    className="rounded-lg"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {canUseAdvancedActions
                    ? "Press Enter to send • Hold the mic to dictate • Voice output plays replies • Upload when OpenAI is configured"
                    : "Press Enter to send • Voice output plays Coach B replies • Answers use Braik team context when available"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
