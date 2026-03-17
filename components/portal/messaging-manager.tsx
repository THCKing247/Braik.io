"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns"
import { MessageSquare, Plus, Paperclip, Send, Lock, Search, Users, X, RefreshCw } from "lucide-react"
import { getMessagingPermissions, getUserType } from "@/lib/enforcement/messaging-permissions"
import { supabaseClient } from "@/src/lib/supabaseClient"

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
  const [initialLoading, setInitialLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageBody, setMessageBody] = useState("")
  const [attachments, setAttachments] = useState<any[]>([])
  const [showCreateThread, setShowCreateThread] = useState(false)
  const [showThreadTypeMenu, setShowThreadTypeMenu] = useState(false)
  const [threadType, setThreadType] = useState<"coach" | "player" | "parent" | "group" | null>(null)
  const [newThreadSubject, setNewThreadSubject] = useState("")
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredThreads, setFilteredThreads] = useState<Thread[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const realtimeSubscriptionRef = useRef<any>(null)
  const optimisticMessageIdRef = useRef<string | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef<boolean>(false)
  const [refreshing, setRefreshing] = useState(false)

  const permissions = getMessagingPermissions(userRole as any)
  const canCreateThread = permissions.canCreateThread()

  useEffect(() => {
    setInitialLoading(true)
    setError(null)
    const loadData = async () => {
      try {
        await Promise.all([loadThreads(), loadContacts()])
      } catch (err) {
        console.error("Error loading initial data:", err)
        setError("Failed to load messages. Please refresh the page.")
      } finally {
        setInitialLoading(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  useEffect(() => {
    // Initialize filtered threads when threads change
    setFilteredThreads(threads)
  }, [threads])

  // Load messages only when threadId changes (not when selectedThread object changes)
  useEffect(() => {
    const threadId = selectedThread?.id
    if (threadId) {
      loadMessages(threadId)
      
      // Set up automatic refresh every 10 seconds
      refreshIntervalRef.current = setInterval(() => {
        // Use a closure to capture the current threadId
        const currentThreadId = selectedThread?.id
        if (currentThreadId && !isRefreshingRef.current) {
          refreshMessages(currentThreadId)
        }
      }, 10000) // Refresh every 10 seconds
    } else {
      setMessages([])
      // Cleanup subscription when no thread selected
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe()
        realtimeSubscriptionRef.current = null
      }
    }
    // Cleanup: unsubscribe from previous thread's realtime and clear interval
    return () => {
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe()
        realtimeSubscriptionRef.current = null
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id]) // Only depend on threadId, not the whole object

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Filter threads based on search query
    if (searchQuery.trim()) {
      const filtered = threads.filter(thread => {
        const displayName = getThreadDisplayName(thread).toLowerCase()
        const lastMessage = thread.messages[0]?.body?.toLowerCase() || ""
        return displayName.includes(searchQuery.toLowerCase()) || lastMessage.includes(searchQuery.toLowerCase())
      })
      setFilteredThreads(filtered)
    } else {
      setFilteredThreads(threads)
    }
  }, [searchQuery, threads])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadThreads = async () => {
    try {
      const response = await fetch(`/api/messages/threads?teamId=${teamId}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to load threads")
      }
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
      setError(null)
    } catch (error: any) {
      console.error("Error loading threads:", error)
      setError(error.message || "Failed to load threads")
    }
  }

  const loadContacts = async () => {
    try {
      const response = await fetch(`/api/messages/contacts?teamId=${teamId}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to load contacts")
      }
      const data = await response.json()
      setContacts(data)
    } catch (error: any) {
      console.error("Error loading contacts:", error)
      // Non-fatal error for contacts, don't set main error state
    }
  }

  const loadMessages = async (threadId: string, showLoading = true) => {
    if (showLoading) {
      setMessagesLoading(true)
    }
    try {
      const response = await fetch(`/api/messages/threads/${threadId}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to load messages")
      }
      const data = await response.json()
      
      // Only update messages, don't update selectedThread (prevents refetch loop)
      setMessages(data.messages || [])
      
      // Update selectedThread metadata only if it's missing or different
      setSelectedThread(prev => {
        if (!prev || prev.id !== threadId) {
          return data
        }
        // Merge new data but keep the same object reference if threadId matches
        return {
          ...prev,
          ...data,
          messages: data.messages || []
        }
      })
      
      setError(null)
      
      // Setup realtime subscription for this thread (only on initial load)
      if (showLoading) {
        setupRealtimeSubscription(threadId)
      }
    } catch (error: any) {
      console.error("Error loading messages:", error)
      setError(error.message || "Failed to load messages")
    } finally {
      if (showLoading) {
        setMessagesLoading(false)
      }
    }
  }

  const refreshMessages = async (threadId: string) => {
    if (isRefreshingRef.current) return // Prevent concurrent refreshes
    isRefreshingRef.current = true
    try {
      await loadMessages(threadId, false) // Don't show loading spinner for background refresh
      // Also refresh thread list to update last message timestamps
      await loadThreads()
    } catch (error) {
      console.error("Error refreshing messages:", error)
    } finally {
      isRefreshingRef.current = false
    }
  }

  const handleManualRefresh = async () => {
    if (!selectedThread?.id) return
    setRefreshing(true)
    try {
      await loadMessages(selectedThread.id, true)
      await loadThreads()
    } catch (error) {
      console.error("Error refreshing messages:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const setupRealtimeSubscription = (threadId: string) => {
    // Cleanup existing subscription
    if (realtimeSubscriptionRef.current) {
      realtimeSubscriptionRef.current.unsubscribe()
      realtimeSubscriptionRef.current = null
    }

    // Subscribe to new messages for this thread
    const subscription = supabaseClient
      .channel(`messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`
        },
        async (payload) => {
          // Skip if this is our optimistic message
          if (optimisticMessageIdRef.current === payload.new.id) {
            optimisticMessageIdRef.current = null
            return
          }

          // Fetch the new message details from API
          try {
            const response = await fetch(`/api/messages/threads/${threadId}`)
            if (response.ok) {
              const data = await response.json()
              // Deduplicate: only add messages we don't already have
              setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id))
                const newMessages = (data.messages || []).filter((m: Message) => !existingIds.has(m.id))
                if (newMessages.length === 0) return prev
                
                // Merge and sort by created_at
                const merged = [...prev, ...newMessages]
                return merged.sort((a, b) => {
                  const aTime = new Date(a.createdAt).getTime()
                  const bTime = new Date(b.createdAt).getTime()
                  return aTime - bTime
                })
              })
            }
          } catch (error) {
            console.error("Error fetching new message details:", error)
          }
        }
      )
      .subscribe()

    realtimeSubscriptionRef.current = subscription
  }

  const handleSendMessage = async () => {
    if (!selectedThread || !messageBody.trim()) return

    if (selectedThread.isReadOnly) {
      alert("You have read-only access to this thread")
      return
    }

    const messageText = messageBody.trim()
    const messageAttachments = attachments.length > 0 ? attachments : []
    
    // Create optimistic message
    const tempId = `temp-${Date.now()}-${Math.random()}`
    // Try to get user info from contacts or use placeholder
    const currentUserContact = contacts.find(c => c.id === userId)
    const optimisticMessage: Message = {
      id: tempId,
      body: messageText,
      attachments: messageAttachments,
      createdAt: new Date(),
      creator: {
        id: userId,
        name: currentUserContact?.name || null,
        email: currentUserContact?.email || ""
      }
    }

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage])
    setMessageBody("")
    setAttachments([])
    setError(null)

    setLoading(true)
    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThread.id,
          body: messageText,
          attachments: messageAttachments,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempId))
        const errorMessage = responseData.error || responseData.details || "Failed to send message"
        const fullError = responseData.details || responseData.code 
          ? `${errorMessage}${responseData.details ? ` (${responseData.details})` : ''}${responseData.code ? ` [${responseData.code}]` : ''}`
          : errorMessage
        console.error("[handleSendMessage] API error:", {
          status: response.status,
          error: responseData,
          fullError
        })
        throw new Error(fullError)
      }

      // Replace optimistic message with real message
      const newMessage = responseData
      optimisticMessageIdRef.current = newMessage.id
      setMessages(prev => {
        // Remove optimistic message and add real message
        const filtered = prev.filter(m => m.id !== tempId)
        // Check if message already exists (from realtime)
        const exists = filtered.some(m => m.id === newMessage.id)
        if (exists) {
          return filtered
        }
        return [...filtered, newMessage].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
      
      // Refresh thread list to update last message
      loadThreads()
    } catch (error: any) {
      const errorMessage = error.message || "Error sending message"
      setError(errorMessage)
      // Also show alert for immediate feedback
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateThread = async () => {
    // Validation
    if (threadType === "group" && !newThreadSubject.trim()) {
      alert("Group name is required")
      return
    }
    if (selectedContacts.length === 0) {
      alert("Please select at least one participant")
      return
    }
    if (threadType !== "group" && selectedContacts.length !== 1) {
      alert(`Please select exactly one ${threadType}`)
      return
    }

    setLoading(true)
    try {
      // For individual threads, generate subject from contact name if not provided
      let subject = newThreadSubject.trim()
      if (!subject && threadType !== "group" && selectedContacts.length === 1) {
        const contact = contacts.find(c => c.id === selectedContacts[0])
        subject = contact ? `Chat with ${contact.name}` : "New Conversation"
      }

      const response = await fetch("/api/messages/threads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          subject: subject || "New Conversation",
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
      setThreadType(null)
      setError(null)
    } catch (error: any) {
      const errorMessage = error.message || "Error creating thread"
      setError(errorMessage)
      alert(errorMessage)
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
      setError(null)
    } catch (error: any) {
      const errorMessage = error.message || "Error uploading file"
      setError(errorMessage)
      alert(errorMessage)
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

  const getFilteredContacts = () => {
    if (!threadType) return contacts
    
    switch (threadType) {
      case "coach":
        return contacts.filter(c => {
          const typeUpper = c.type?.toUpperCase() || ""
          const roleLower = c.role?.toLowerCase() || ""
          return typeUpper === "HEAD_COACH" || 
                 typeUpper === "ASSISTANT_COACH" || 
                 roleLower === "head_coach" || 
                 roleLower === "assistant_coach"
        })
      case "player":
        return contacts.filter(c => {
          const typeUpper = c.type?.toUpperCase() || ""
          const roleLower = c.role?.toLowerCase() || ""
          return typeUpper === "PLAYER" || roleLower === "player"
        })
      case "parent":
        return contacts.filter(c => {
          const typeUpper = c.type?.toUpperCase() || ""
          const roleLower = c.role?.toLowerCase() || ""
          return typeUpper === "PARENT" || roleLower === "parent"
        })
      case "group":
        return contacts // Show all for group
      default:
        return contacts
    }
  }

  const handleThreadTypeSelect = (type: "coach" | "player" | "parent" | "group") => {
    setThreadType(type)
    setShowCreateThread(true)
    setShowThreadTypeMenu(false)
    setSelectedContacts([])
    setNewThreadSubject("")
  }

  const handleCancelCreate = () => {
    setShowCreateThread(false)
    setThreadType(null)
    setShowThreadTypeMenu(false)
    setNewThreadSubject("")
    setSelectedContacts([])
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowThreadTypeMenu(false)
      }
    }

    if (showThreadTypeMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showThreadTypeMenu])

  if (initialLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-200px)] rounded-lg overflow-hidden border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
      {/* Error Banner */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-md text-sm max-w-md">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Thread List Sidebar */}
      <div className="w-80 border-r flex flex-col h-full" style={{ backgroundColor: "#FFFFFF", borderRightColor: "rgb(var(--border))" }}>
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderBottomColor: "rgb(var(--border))" }}>
          <h2 className="font-semibold text-lg" style={{ color: "rgb(var(--text))" }}>Messages</h2>
          {canCreateThread && (
            <div className="relative" ref={menuRef}>
              <Button
                size="sm"
                onClick={() => {
                  if (showCreateThread) {
                    handleCancelCreate()
                  } else {
                    setShowThreadTypeMenu(!showThreadTypeMenu)
                  }
                }}
                className="h-8 w-8 p-0"
                style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {showThreadTypeMenu && !showCreateThread && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border rounded-md shadow-lg min-w-[180px]" style={{ borderColor: "rgb(var(--border))" }}>
                  <button
                    onClick={() => handleThreadTypeSelect("coach")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 first:rounded-t-md"
                    style={{ color: "rgb(var(--text))" }}
                  >
                    Message Coach
                  </button>
                  <button
                    onClick={() => handleThreadTypeSelect("player")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    style={{ color: "rgb(var(--text))" }}
                  >
                    Message Player
                  </button>
                  <button
                    onClick={() => handleThreadTypeSelect("parent")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    style={{ color: "rgb(var(--text))" }}
                  >
                    Message Parent
                  </button>
                  <button
                    onClick={() => handleThreadTypeSelect("group")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 last:rounded-b-md border-t"
                    style={{ color: "rgb(var(--text))", borderTopColor: "rgb(var(--border))" }}
                  >
                    Create Group
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b flex-shrink-0" style={{ borderBottomColor: "rgb(var(--border))" }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: "rgb(var(--muted))" }} />
            <Input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 text-sm"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            />
          </div>
        </div>

        {showCreateThread && threadType && (
          <div className="p-4 border-b flex-shrink-0" style={{ backgroundColor: "rgb(var(--platinum))", borderBottomColor: "rgb(var(--border))" }}>
            <div className="space-y-3">
              {threadType === "group" && (
                <div>
                  <Label className="text-xs" style={{ color: "rgb(var(--text))" }}>Group Name</Label>
                  <Input
                    value={newThreadSubject}
                    onChange={(e) => setNewThreadSubject(e.target.value)}
                    placeholder="Enter group name"
                    className="h-8 text-sm"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "rgb(var(--border))",
                      color: "rgb(var(--text))",
                    }}
                  />
                </div>
              )}
              <div>
                <Label className="text-xs" style={{ color: "rgb(var(--text))" }}>
                  {threadType === "group" ? "Select Members" : `Select ${threadType.charAt(0).toUpperCase() + threadType.slice(1)}`}
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowParticipantsModal(true)}
                  className="w-full justify-start"
                  style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  {selectedContacts.length > 0 
                    ? threadType === "group"
                      ? `${selectedContacts.length} member${selectedContacts.length !== 1 ? "s" : ""} selected`
                      : contacts.find(c => c.id === selectedContacts[0])?.name || "Selected"
                    : `Select ${threadType === "group" ? "members" : threadType}`}
                </Button>
                {selectedContacts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedContacts.map(contactId => {
                      const contact = contacts.find(c => c.id === contactId)
                      return contact ? (
                        <div
                          key={contactId}
                          className="text-xs px-2 py-1 rounded border flex items-center gap-1"
                          style={{
                            backgroundColor: "rgb(var(--platinum))",
                            borderColor: "rgb(var(--border))",
                            color: "rgb(var(--text))",
                          }}
                        >
                          <span>{contact.name}</span>
                          <button
                            onClick={() => setSelectedContacts(selectedContacts.filter(id => id !== contactId))}
                            className="hover:opacity-70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleCreateThread} 
                  disabled={loading || (threadType === "group" && !newThreadSubject.trim()) || selectedContacts.length === 0 || (threadType !== "group" && selectedContacts.length !== 1)}
                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                >
                  Create
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCancelCreate}
                  style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                {canCreateThread ? "No threads yet. Create one to get started!" : "No threads available."}
              </p>
            </div>
          ) : (
            (searchQuery ? filteredThreads : threads).map((thread) => {
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
                    backgroundColor: isSelected ? "rgb(var(--platinum))" : "transparent",
                    borderLeft: isSelected ? "4px solid rgb(var(--accent))" : "4px solid transparent",
                    borderBottom: "1px solid rgb(var(--border))",
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
            })
          )}
        </div>
      </div>

      {/* Message View */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedThread ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b flex-shrink-0" style={{ borderBottomColor: "rgb(var(--border))" }}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="font-semibold text-lg" style={{ color: "rgb(var(--text))" }}>
                    {getThreadDisplayName(selectedThread)}
                    {selectedThread.isReadOnly && (
                      <span className="ml-2 text-xs font-normal" style={{ color: "rgb(var(--muted))" }}>
                        (Read-only)
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                      {selectedThread.participants.length} participant{selectedThread.participants.length !== 1 ? "s" : ""}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowParticipantsModal(true)}
                      className="h-6 px-2 text-xs"
                      style={{ color: "rgb(var(--accent))" }}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      Manage
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleManualRefresh}
                  disabled={refreshing || messagesLoading}
                  className="h-8 w-8 p-0"
                  title="Refresh messages"
                  style={{ color: "rgb(var(--accent))" }}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0 }}>
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--accent))] border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p style={{ color: "rgb(var(--muted))" }}>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
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
              }))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {!selectedThread.isReadOnly && (
              <div className="p-4 border-t flex-shrink-0" style={{ borderTopColor: "rgb(var(--border))" }}>
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
                    className="flex-1 min-h-[60px] rounded-md border-2 border-border bg-background text-foreground px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#0B2A5B"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={loading || !messageBody.trim()}
                    style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                  >
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

      {/* Participants Modal */}
      <Dialog open={showParticipantsModal} onOpenChange={setShowParticipantsModal}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>
              {threadType === "group" 
                ? "Select Group Members" 
                : `Select ${threadType ? threadType.charAt(0).toUpperCase() + threadType.slice(1) : "Participant"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="max-h-96 overflow-y-auto space-y-2">
              {getFilteredContacts().length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: "rgb(var(--muted))" }}>
                  No {threadType}s available
                </p>
              ) : (
                getFilteredContacts().map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center space-x-3 p-2 rounded cursor-pointer hover:bg-gray-100"
                  >
                    <input
                      type={threadType === "group" ? "checkbox" : "radio"}
                      name={threadType === "group" ? undefined : "participant"}
                      checked={selectedContacts.includes(contact.id)}
                      onChange={(e) => {
                        if (threadType === "group") {
                          // Multiple selection for groups
                          if (e.target.checked) {
                            setSelectedContacts([...selectedContacts, contact.id])
                          } else {
                            setSelectedContacts(selectedContacts.filter(id => id !== contact.id))
                          }
                        } else {
                          // Single selection for individual threads
                          if (e.target.checked) {
                            setSelectedContacts([contact.id])
                          }
                        }
                      }}
                      className={threadType === "group" ? "w-4 h-4" : "w-4 h-4"}
                      style={{ accentColor: "rgb(var(--accent))" }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                        {contact.name}
                      </p>
                      <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                        {contact.email} • {contact.role}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-2 pt-4 border-t" style={{ borderTopColor: "rgb(var(--border))" }}>
              <Button
                onClick={() => {
                  setShowParticipantsModal(false)
                  // If no selection and not a group, close the create thread form
                  if (threadType !== "group" && selectedContacts.length === 0) {
                    handleCancelCreate()
                  }
                }}
                variant="outline"
                style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
