"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageSquare, X, Send, Upload, Sparkles, File, AlertTriangle } from "lucide-react"
import { AIActionConfirmation } from "@/components/ai-action-confirmation"

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

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          data-ai-widget
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-16 w-16 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center z-50 border-2"
          style={{
            backgroundColor: primaryColor,
            borderColor: primaryColor,
            boxShadow: `0 10px 15px -3px ${primaryColor}40, 0 4px 6px -2px ${primaryColor}40`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 20px 25px -5px ${primaryColor}50, 0 10px 10px -5px ${primaryColor}50`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 10px 15px -3px ${primaryColor}40, 0 4px 6px -2px ${primaryColor}40`
          }}
          aria-label="Open AI Assistant"
        >
          <MessageSquare className="h-7 w-7" style={{ color: "white" }} />
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] rounded-xl shadow-2xl z-50 flex flex-col border-2" style={{ borderColor: "#0B2A5B", backgroundColor: "#FFFFFF" }}>
          <Card className="flex-1 flex flex-col border-0 shadow-none" style={{ backgroundColor: "#FFFFFF" }}>
            <CardHeader className="rounded-t-xl" style={{ backgroundColor: "#3B82F6", color: "#FFFFFF" }}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-athletic uppercase" style={{ color: "#FFFFFF" }}>
                  <Sparkles className="h-5 w-5" style={{ color: "#FFFFFF" }} />
                  AI Assistant
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg hover:bg-white/20"
                  style={{ color: "#FFFFFF" }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden" style={{ backgroundColor: "#FFFFFF" }}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: "#FFFFFF" }}>
                {messages.length === 0 && (
                  <div className="text-center py-12" style={{ color: "rgb(var(--text))" }}>
                    <Sparkles className="h-16 w-16 mx-auto mb-4" style={{ color: "#3B82F6" }} />
                    <p className="text-sm font-medium mb-2" style={{ color: "rgb(var(--text))" }}>
                      Hi! I'm your AI assistant. Ask me about your team, schedule, or get help with
                      tasks.
                    </p>
                    {userRole === "HEAD_COACH" || userRole === "ASSISTANT_COACH" ? (
                      <p className="text-xs mt-2" style={{ color: "rgb(var(--text2))" }}>
                        I can help you create events, send messages, and manage your team.
                      </p>
                    ) : (
                      <p className="text-xs mt-2" style={{ color: "rgb(var(--text2))" }}>
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
                        className={`max-w-[80%] rounded-lg p-4 shadow-md ${
                          message.role === "user"
                            ? ""
                            : message.type === "error"
                            ? "bg-danger/10 text-danger border-2 border-danger/20"
                            : message.type === "action_proposal"
                            ? "bg-warning/10 text-text border-2 border-warning/20"
                            : "bg-surface text-text border-2"
                        }`}
                        style={
                          message.role === "user"
                            ? { backgroundColor: "#3B82F6", color: "#FFFFFF" }
                            : message.type === "error" || message.type === "action_proposal"
                            ? {}
                            : { borderColor: "#0B2A5B" }
                        }
                      >
                        {message.type === "action_proposal" && (
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <span className="text-xs font-semibold text-warning">Action Requires Approval</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        {message.usage && (
                          <p className="text-xs mt-2 text-text-2">
                            Tokens: {message.usage.tokensUsed} (weighted) • {message.usage.rawTokens} raw
                          </p>
                        )}
                        {message.usageStatus && (
                          <p className="text-xs mt-1 text-text-2">
                            Usage: {message.usageStatus.usagePercentage.toFixed(1)}% • Mode: {message.usageStatus.mode}
                          </p>
                        )}
                        <p className={`text-xs mt-2 ${message.role === "user" ? "opacity-80" : "text-text-2"}`}>
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
                    <div className="bg-surface-2 rounded-lg p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-text-2 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-text-2 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                        <div className="w-2 h-2 bg-text-2 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t-2 p-4" style={{ borderTopColor: "#0B2A5B", backgroundColor: "#FFFFFF" }}>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={loading || uploading}
                    className="flex-1"
                  />
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
                  <Button onClick={handleSend} disabled={loading || uploading || !input.trim()} size="sm" className="rounded-lg">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-text-2">
                  Press Enter to send • Upload files to extract schedule/events • AI parsing available when OpenAI is configured
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
