"use client"

import { useState, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageSquare, X, Send, Upload, Sparkles, File, AlertTriangle, Mic, Loader2 } from "lucide-react"
import { AIActionConfirmation } from "@/components/ai/ai-action-confirmation"
import { useCoachB } from "@/components/portal/coach-b-context"
import { cn } from "@/lib/utils"
import { trackProductEvent } from "@/lib/utils/analytics-client"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"
import { MobileFab } from "@/components/mobile/mobile-fab"
import { useCoachBRotatingCopy } from "@/lib/hooks/use-coach-b-rotating-copy"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
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
  const isPlayEditorRoute = pathname?.startsWith("/dashboard/playbooks/play/") ?? false
  const [feedbackVoted, setFeedbackVoted] = useState<Set<string>>(() => new Set())
  const [voiceMode, setVoiceMode] = useState(false)
  const [voicePhase, setVoicePhase] = useState<"idle" | "recording" | "processing">("idle")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const lastRequestIdempotencyRef = useRef<string | null>(null)

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

  const CONFIRM_RE = /^(yes|yeah|yep|send it|confirm|go ahead|do it)\b/i

  /** Same Coach B pipeline as typed chat; used after voice transcription. */
  const callCoachBChat = async (opts: {
    message: string
    conversationHistory: Array<{ role: string; content: string }>
    inputSource: "text" | "voice"
    confirmProposalId?: string
  }) => {
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    lastRequestIdempotencyRef.current = idempotencyKey

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
      }),
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: response.ok, data }
  }

  const applyCoachBResponse = (data: Record<string, unknown>) => {
    const t = data.type
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
        timestamp: new Date(),
        type: "action_executed",
      }
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
      timestamp: new Date(),
      type: (t as Message["type"]) || "response",
      usage: data.usage as Message["usage"],
      usageStatus: data.usageStatus as Message["usageStatus"],
    }
    setMessages((prev) => [...prev, assistantMessage])
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const outgoing = input.trim()
    const confirmProposalId =
      activeProposalId && CONFIRM_RE.test(outgoing) ? activeProposalId : undefined
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

  const stopMediaRecorder = () => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop()
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null
  }

  useEffect(() => {
    return () => {
      stopMediaRecorder()
    }
  }, [])

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
      })
      const voiceData = (await voiceRes.json().catch(() => ({}))) as Record<string, unknown>

      if (!voiceRes.ok) {
        const errText =
          typeof voiceData.error === "string" ? voiceData.error : "Transcription or auth failed. Please try again."
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

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: transcript,
        timestamp: new Date(),
        source: "voice_transcript",
      }
      setMessages((prev) => [...prev, userMessage])

      const historyForApi = priorMessages.map((m) => ({ role: m.role, content: m.content }))
      const confirmProposalId =
        activeProposalId && CONFIRM_RE.test(transcript) ? activeProposalId : undefined

      const { ok, data } = await callCoachBChat({
        message: transcript,
        conversationHistory: historyForApi,
        inputSource: "voice",
        confirmProposalId,
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
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: "Voice processing failed. Please try again.",
          timestamp: new Date(),
          type: "error",
        },
      ])
    } finally {
      setVoicePhase("idle")
      setLoading(false)
    }
  }

  const toggleRecording = async () => {
    if (voicePhase === "processing" || loading || uploading) return
    if (voicePhase === "recording") {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== "inactive") {
        try {
          mr.stop()
        } catch {
          /* ignore */
        }
      }
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
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
        const parts = audioChunksRef.current
        audioChunksRef.current = []
        if (parts.length === 0) {
          setVoicePhase("idle")
          return
        }
        const blob = new Blob(parts, { type: mr.mimeType || mimeType })
        void sendVoiceBlob(blob)
      }
      mr.start(200)
      mediaRecorderRef.current = mr
      setVoicePhase("recording")
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Microphone permission is required for voice input.",
          timestamp: new Date(),
          type: "error",
        },
      ])
    }
  }

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
                          onConfirmed={() => {
                            setActiveProposalId(null)
                            // Add success message
                            const successMessage: Message = {
                              id: Date.now().toString(),
                              role: "assistant",
                              content: "Action confirmed and executed successfully!",
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
                {canUseAdvancedActions && (
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={voiceMode}
                        onChange={(e) => setVoiceMode(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Voice input (microphone)
                    </label>
                    {voiceMode && (
                      <span className="text-[10px] text-gray-500">
                        {voicePhase === "recording" ? "Recording… tap again to stop" : voicePhase === "processing" ? "Processing…" : ""}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex gap-2 mb-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={loading || uploading || voicePhase === "recording"}
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
                        disabled={loading || uploading || voicePhase === "recording"}
                        title="Upload file (Excel, CSV, PDF, Image)"
                        className="rounded-lg border-2"
                        style={{ borderColor: "#0B2A5B", color: "#0B2A5B" }}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {canUseAdvancedActions && voiceMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleRecording()}
                      disabled={loading || uploading || voicePhase === "processing"}
                      title={voicePhase === "recording" ? "Stop recording" : "Start recording"}
                      className={cn(
                        "rounded-lg border-2",
                        voicePhase === "recording" ? "border-red-600 text-red-600 bg-red-50" : ""
                      )}
                      style={voicePhase !== "recording" ? { borderColor: "#0B2A5B", color: "#0B2A5B" } : undefined}
                    >
                      {voicePhase === "processing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={handleSend}
                    disabled={loading || uploading || !input.trim() || voicePhase === "recording"}
                    size="sm"
                    className="rounded-lg"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {canUseAdvancedActions
                    ? "Press Enter to send • Enable voice input for the mic • Upload files when OpenAI is configured"
                    : "Press Enter to send • Answers use Braik team context when available"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
