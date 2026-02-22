"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { MessageSquare, Plus, Paperclip, Send, Lock } from "lucide-react"
import { getMessagingPermissions, getUserType } from "@/lib/messaging-permissions"

interface Message {
  id: string
  body: string
  attachments: any
  createdAt: Date
  creator: { id: string; name: string | null; email: string }
}

interface ThreadParticipant {
  id: string
  userId: string
  readOnly: boolean
  user: { id: string; name: string | null; email: string }
}

interface Thread {
  id: string
  subject: string | null
  threadType: string
  createdAt: Date
  updatedAt: Date
  creator: { id: string; name: string | null; email: string }
  participants: ThreadParticipant[]
  messages: Message[]
  _count: { messages: number }
  isReadOnly?: boolean
  canReply?: boolean
}

interface Contact {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  type: string
}

interface MessagingManagerProps {
  teamId: string
  userRole: string
  userId: string
  initialThreads?: Thread[]
}

export function MessagingManager({ teamId, userRole, userId, initialThreads = [] }: MessagingManagerProps) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [messageBody, setMessageBody] = useState("")
  const [attachments, setAttachments] = useState<any[]>([])
  const [showCreateThread, setShowCreateThread] = useState(false)
  const [newThreadSubject, setNewThreadSubject] = useState("")
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const permissions = getMessagingPermissions(userRole as any)
  const canCreateThread = permissions.canCreateThread()

  useEffect(() => {
    loadThreads()
    loadContacts()
  }, [teamId])

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.id)
    }
  }, [selectedThread])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadThreads = async () => {
    try {
      const response = await fetch(`/api/messages/threads?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        setThreads(data)
        // Auto-select General Chat if available and no thread selected
        if (!selectedThread && data.length > 0) {
          const generalChat = data.find((t: Thread) => t.threadType === "GENERAL")
          if (generalChat) {
            setSelectedThread(generalChat)
          } else {
            setSelectedThread(data[0])
          }
        }
      }
    } catch (error) {
      console.error("Error loading threads:", error)
    }
  }

  const loadContacts = async () => {
    try {
      const response = await fetch(`/api/messages/contacts?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        setContacts(data)
      }
    } catch (error) {
      console.error("Error loading contacts:", error)
    }
  }

  const loadMessages = async (threadId: string) => {
    try {
      const response = await fetch(`/api/messages/threads/${threadId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
        setSelectedThread(data)
      }
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedThread || !messageBody.trim()) return

    if (selectedThread.isReadOnly) {
      alert("You have read-only access to this thread")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThread.id,
          body: messageBody,
          attachments: attachments.length > 0 ? attachments : null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send message")
      }

      const newMessage = await response.json()
      setMessages([...messages, newMessage])
      setMessageBody("")
      setAttachments([])
      loadThreads() // Refresh thread list to update last message
    } catch (error: any) {
      alert(error.message || "Error sending message")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateThread = async () => {
    if (!newThreadSubject.trim() || selectedContacts.length === 0) {
      alert("Subject and at least one participant are required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/messages/threads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          subject: newThreadSubject,
          participantUserIds: selectedContacts,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create thread")
      }

      const newThread = await response.json()
      setThreads([newThread, ...threads])
      setSelectedThread(newThread)
      setNewThreadSubject("")
      setSelectedContacts([])
      setShowCreateThread(false)
    } catch (error: any) {
      alert(error.message || "Error creating thread")
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type and size
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
    ]

    if (!allowedTypes.includes(file.type)) {
      alert("File type not supported. Allowed: PDFs, images, documents, and short videos (max 50MB)")
      return
    }

    if (file.type.startsWith("video/") && file.size > 50 * 1024 * 1024) {
      alert("Video files must be 50MB or smaller")
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("teamId", teamId)

      const response = await fetch("/api/messages/attachments", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload file")
      }

      const data = await response.json()
      setAttachments([...attachments, data])
    } catch (error) {
      alert("Error uploading file")
    } finally {
      setLoading(false)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const getThreadDisplayName = (thread: Thread) => {
    if (thread.threadType === "GENERAL") {
      return "General Chat"
    }
    if (thread.subject) {
      return thread.subject
    }
    // Show participant names
    const otherParticipants = thread.participants
      .filter(p => p.user.id !== userId)
      .map(p => p.user.name || p.user.email)
    return otherParticipants.join(", ") || "New Thread"
  }

  return (
    <div className="flex h-[calc(100vh-200px)] rounded-lg overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "2px solid #0B2A5B", outline: "none" }}>
      {/* Thread List Sidebar */}
      <div className="w-80 border-r-2 flex flex-col" style={{ backgroundColor: "#FFFFFF", borderRightColor: "#0B2A5B" }}>
        <div className="p-4 border-b-2 flex items-center justify-between" style={{ borderBottomColor: "#0B2A5B" }}>
          <h2 className="font-semibold text-lg" style={{ color: "rgb(var(--text))" }}>Messages</h2>
          {canCreateThread && (
            <Button
              size="sm"
              onClick={() => setShowCreateThread(!showCreateThread)}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {showCreateThread && (
          <div className="p-4" style={{ backgroundColor: "#FFFFFF", borderBottom: "2px solid #0B2A5B" }}>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Subject</Label>
                <Input
                  value={newThreadSubject}
                  onChange={(e) => setNewThreadSubject(e.target.value)}
                  placeholder="Thread subject"
                  className="h-8 text-sm border-2 focus:border-[#0B2A5B] focus:ring-2 focus:ring-[#0B2A5B]"
                  style={{
                    borderColor: "#0B2A5B",
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Participants</Label>
                <div className="max-h-32 overflow-y-auto border-2 rounded p-2 space-y-1" style={{ borderColor: "#0B2A5B" }}>
                  {contacts.map((contact) => (
                    <label key={contact.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContacts([...selectedContacts, contact.id])
                          } else {
                            setSelectedContacts(selectedContacts.filter(id => id !== contact.id))
                          }
                        }}
                      />
                      <span style={{ color: "rgb(var(--text))" }}>{contact.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateThread} disabled={loading}>
                  Create
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowCreateThread(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {threads.map((thread) => {
            const isSelected = selectedThread?.id === thread.id
            const lastMessage = thread.messages[0]
            const isReadOnly = thread.isReadOnly || false

            return (
              <div
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={`p-3 cursor-pointer transition-colors ${
                  isSelected ? "" : ""
                }`}
                style={{
                  backgroundColor: isSelected ? "transparent" : "transparent",
                  borderLeft: isSelected ? "4px solid #0B2A5B" : "4px solid transparent",
                  borderBottom: "2px solid #0B2A5B",
                }}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "rgb(var(--accent))" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate" style={{ color: "rgb(var(--text))" }}>
                        {getThreadDisplayName(thread)}
                      </h3>
                      {isReadOnly && <Lock className="h-3 w-3" style={{ color: "rgb(var(--muted))" }} />}
                    </div>
                    {lastMessage && (
                      <p className="text-xs truncate mt-1" style={{ color: "rgb(var(--text2))" }}>
                        {lastMessage.creator.name || lastMessage.creator.email}: {lastMessage.body.substring(0, 50)}
                        {lastMessage.body.length > 50 ? "..." : ""}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: "rgb(var(--muted))" }}>
                      {format(new Date(thread.updatedAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Message View */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Thread Header */}
            <div className="p-4" style={{ borderBottom: "2px solid #0B2A5B" }}>
              <h2 className="font-semibold text-lg" style={{ color: "rgb(var(--text))" }}>
                {getThreadDisplayName(selectedThread)}
                {selectedThread.isReadOnly && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "rgb(var(--muted))" }}>
                    (Read-only)
                  </span>
                )}
              </h2>
              <p className="text-xs mt-1" style={{ color: "rgb(var(--muted))" }}>
                {selectedThread.participants.length} participant{selectedThread.participants.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwnMessage = message.creator.id === userId
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isOwnMessage
                          ? ""
                          : ""
                      }`}
                      style={
                        isOwnMessage
                          ? {
                              backgroundColor: "#0B2A5B",
                              color: "#FFFFFF",
                            }
                          : {
                              backgroundColor: "#FFFFFF",
                              borderColor: "#3B82F6",
                              borderWidth: "2px",
                              borderStyle: "solid",
                              color: "rgb(var(--text))",
                            }
                      }
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                      {message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.attachments.map((att: any, idx: number) => {
                            // Use secure endpoint for file access
                            const secureUrl = att.id 
                              ? `/api/messages/attachments/${att.id}`
                              : `/api/messages/attachments/serve?fileUrl=${encodeURIComponent(att.fileUrl)}`
                            return (
                              <a
                                key={idx}
                                href={secureUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs underline block"
                              >
                                📎 {att.fileName}
                              </a>
                            )
                          })}
                        </div>
                      )}
                      <p className={`text-xs mt-2 ${isOwnMessage ? "opacity-80" : ""}`}>
                        {message.creator.name || message.creator.email} • {format(new Date(message.createdAt), "h:mm a")}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {!selectedThread.isReadOnly && (
              <div className="p-4" style={{ borderTop: "2px solid #0B2A5B" }}>
                {attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="text-xs px-2 py-1 rounded border-2 flex items-center gap-1"
                        style={{
                          backgroundColor: "rgb(var(--platinum))",
                          borderColor: "#0B2A5B",
                        }}
                      >
                        <span>{att.fileName}</span>
                        <button
                          onClick={() => removeAttachment(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer p-2 rounded hover:bg-opacity-50" style={{ backgroundColor: "rgb(var(--platinum))" }}>
                    <Paperclip className="h-4 w-4" style={{ color: "rgb(var(--text))" }} />
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.mp4,.mov,.avi"
                    />
                  </label>
                  <textarea
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 min-h-[60px] rounded-md border-2 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
                    style={{
                      borderColor: "#0B2A5B",
                      backgroundColor: "#FFFFFF",
                      color: "rgb(var(--text))",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#0B2A5B"
                      e.currentTarget.style.boxShadow = "0 0 0 2px rgba(11, 42, 91, 0.2)"
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#0B2A5B"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  />
                  <Button onClick={handleSendMessage} disabled={loading || !messageBody.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ color: "rgb(var(--muted))" }}>Select a thread to view messages</p>
          </div>
        )}
      </div>
    </div>
  )
}
