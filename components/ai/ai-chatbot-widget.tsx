"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageSquare, X, Send, Upload, Sparkles, File, AlertTriangle } from "lucide-react"
import { AIActionConfirmation } from "@/components/ai/ai-action-confirmation"
import { useCoachB } from "@/components/portal/coach-b-context"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
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
  const coachB = useCoachB()

  // When dashboard sidebar is shown (desktop), register open so "Ask Coach B" in sidebar opens this widget; hide floating button.
  useEffect(() => {
    coachB?.registerOpen(() => setIsOpen(true))
  }, [coachB])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          role: userRole,
          message: input,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get AI response")
      }

      const data = await response.json()

      // Handle different response types
      if (data.type === "action_proposal") {
        const proposalMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message || "An action requires your approval.",
          timestamp: new Date(),
          type: "action_proposal",
          proposalId: data.proposalId,
          actionType: data.actionType,
        }
        setMessages((prev) => [...prev, proposalMessage])
        setActiveProposalId(data.proposalId)
      } else if (data.type === "error") {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message || "An error occurred.",
          timestamp: new Date(),
          type: "error",
        }
        setMessages((prev) => [...prev, errorMessage])
      } else {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || "I'm sorry, I couldn't process that request.",
          timestamp: new Date(),
          type: data.type || "response",
          usage: data.usage,
          usageStatus: data.usageStatus,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
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

  const showFloatingButton = !isOpen && !coachB?.isDesktop

  return (
    <>
      {/* Floating Button - only on smaller screens; on desktop the sidebar "Ask Coach B" opens the chat */}
      {showFloatingButton && (
        <button
          data-ai-widget
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center z-50 p-0 overflow-hidden bg-transparent border-0"
          style={{
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.15), 0 4px 6px -2px rgba(0,0,0,0.1)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.15), 0 4px 6px -2px rgba(0,0,0,0.1)"
          }}
          aria-label="Open Coach B"
        >
          <Image
            src="/images/ai-chat-icon-no-bg.png"
            alt="Coach B"
            width={64}
            height={64}
            className="rounded-full object-cover w-full h-full"
          />
        </button>
      )}

      {/* Chat Widget: fixed-height column, scrollable messages, pinned header/footer */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 w-96 h-[600px] rounded-xl shadow-2xl z-50 flex flex-col min-h-0 overflow-hidden border-2 border-[#0B2A5B] bg-white"
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
                        <p className="text-sm">{message.content}</p>
                        {message.usage && (
                          <p className="text-xs mt-2 text-gray-500">
                            Tokens: {message.usage.tokensUsed} (weighted) • {message.usage.rawTokens} raw
                          </p>
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
                    <div className="bg-gray-100 rounded-lg p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area: pinned to bottom */}
              <div className="shrink-0 relative border-t border-[#dbe3f0] p-4 bg-white">
                <div className="flex gap-2 mb-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={loading || uploading}
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
                        disabled={loading || uploading}
                        title="Upload file (Excel, CSV, PDF, Image)"
                        className="rounded-lg border-2"
                        style={{ borderColor: "#0B2A5B", color: "#0B2A5B" }}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button onClick={handleSend} disabled={loading || uploading || !input.trim()} size="sm" className="rounded-lg">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {canUseAdvancedActions
                    ? "Press Enter to send • Upload files to extract schedule/events • AI parsing available when OpenAI is configured"
                    : "Press Enter to send • Role-limited to Coach B Q&A for schedule and team updates"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
