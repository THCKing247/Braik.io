"use client"

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns"
import {
  MessageSquare,
  Paperclip,
  Send,
  Lock,
  Search,
  Users,
  X,
  RefreshCw,
  ArrowDown,
  Star,
  ChevronLeft,
  UserRound,
  Shield,
  Heart,
  UsersRound,
  Trash2,
  Megaphone,
} from "lucide-react"
import { getMessagingPermissions } from "@/lib/enforcement/messaging-permissions"
import { canPostAnnouncements } from "@/lib/auth/roles"
import { formatAnnouncementDateTime, type TeamAnnouncementRow } from "@/lib/team-announcements"
import { supabaseClient } from "@/src/lib/supabaseClient"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  body: string
  attachments: any
  createdAt: Date
  creator: { id: string; name: string | null; email: string }
  isRemoved?: boolean
}

type ParticipantKind = "player" | "coach" | "parent" | "staff"

interface ThreadParticipant {
  id: string
  userId: string
  readOnly: boolean
  participantKind?: ParticipantKind
  user: { id: string; name: string | null; email: string; displayName?: string }
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
  unreadCount?: number
  _count: { messages: number }
  isReadOnly?: boolean
  canReply?: boolean
  canModerate?: boolean
}

function displayNameForParticipantUser(u: ThreadParticipant["user"]) {
  return (u.displayName || u.name || u.email || "Member").trim()
}

function initialsFromDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function starredStorageKey(uid: string, tid: string) {
  return `braik-msg-starred:${uid}:${tid}`
}

function isNearBottomEl(el: HTMLElement, thresholdPx = 56) {
  const { scrollTop, scrollHeight, clientHeight } = el
  return scrollHeight - scrollTop - clientHeight <= thresholdPx
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
  const searchParams = useSearchParams()
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
  const [threadType, setThreadType] = useState<"coach" | "player" | "parent" | "group" | null>(null)
  const [newThreadSubject, setNewThreadSubject] = useState("")
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const realtimeSubscriptionRef = useRef<any>(null)
  const optimisticMessageIdRef = useRef<string | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef<boolean>(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showJumpToNewest, setShowJumpToNewest] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const isUserScrollingRef = useRef<boolean>(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const urlThreadIdProcessedRef = useRef<boolean>(false)
  const [starredThreadIds, setStarredThreadIds] = useState<Set<string>>(new Set())
  const [isWide, setIsWide] = useState(false)
  const [mobileShowList, setMobileShowList] = useState(true)
  const [composeGroupFilter, setComposeGroupFilter] = useState<null | "staff">(null)
  const [participantsModalPurpose, setParticipantsModalPurpose] = useState<"pick" | "view">("pick")
  const [priorityCollapsed, setPriorityCollapsed] = useState(false)
  const messageIngressRef = useRef<"idle" | "full-load" | "poll" | "realtime" | "user-send" | "optimistic">("idle")
  const scrollIntentAfterNextMessagesRef = useRef<"bottom" | "keep">("keep")
  const lastMessageCountRef = useRef<number>(0)

  const permissions = getMessagingPermissions(userRole as any)
  const canCreateThread = permissions.canCreateThread()
  const [announcementPreview, setAnnouncementPreview] = useState<TeamAnnouncementRow[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/team-announcements`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { announcements?: TeamAnnouncementRow[] }
        const list = data.announcements ?? []
        setAnnouncementPreview(list.slice(0, 5))
      } catch {
        if (!cancelled) setAnnouncementPreview([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [teamId])

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
    const mq = window.matchMedia("(min-width: 1024px)")
    const apply = () => setIsWide(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(starredStorageKey(userId, teamId))
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) setStarredThreadIds(new Set(arr))
      }
    } catch {
      /* ignore */
    }
  }, [userId, teamId])

  useEffect(() => {
    if (searchParams?.get("threadId")) return
    if (!isWide || selectedThread || threads.length === 0) return
    const generalChat = threads.find((t) => t.threadType === "GENERAL")
    setSelectedThread(generalChat || threads[0])
  }, [isWide, threads, selectedThread, searchParams])

  // Load messages only when threadId changes (not when selectedThread object changes)
  useEffect(() => {
    const threadId = selectedThread?.id
    if (threadId) {
      lastMessageCountRef.current = 0
      loadMessages(threadId)
      
      // Set up automatic refresh every 10 seconds
      refreshIntervalRef.current = setInterval(() => {
        // Use a closure to capture the current threadId
        const currentThreadId = selectedThread?.id
        if (currentThreadId && !isRefreshingRef.current) {
          refreshMessages(currentThreadId)
        }
      }, 15000)
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

  useLayoutEffect(() => {
    const ingress = messageIngressRef.current
    messageIngressRef.current = "idle"
    const container = messagesContainerRef.current
    const curr = messages.length
    const prev = lastMessageCountRef.current

    const scrollToEndInstant = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
    }

    if (ingress === "full-load") {
      if (curr > 0) scrollToEndInstant()
      setShowJumpToNewest(false)
      setUnreadCount(0)
      lastMessageCountRef.current = curr
      scrollIntentAfterNextMessagesRef.current = "keep"
      return
    }

    if (ingress === "idle" || curr <= prev) {
      lastMessageCountRef.current = curr
      return
    }

    const delta = curr - prev
    const intent = scrollIntentAfterNextMessagesRef.current
    scrollIntentAfterNextMessagesRef.current = "keep"

    if (ingress === "user-send" || ingress === "optimistic") {
      if (intent === "bottom" || (container && isNearBottomEl(container))) {
        scrollToEndInstant()
        setShowJumpToNewest(false)
        setUnreadCount(0)
      } else {
        setShowJumpToNewest(true)
        setUnreadCount((u) => u + delta)
      }
      lastMessageCountRef.current = curr
      return
    }

    if (ingress === "poll" || ingress === "realtime") {
      if (intent === "bottom") {
        scrollToEndInstant()
        setShowJumpToNewest(false)
        setUnreadCount(0)
      } else {
        setShowJumpToNewest(true)
        setUnreadCount((u) => u + delta)
      }
      lastMessageCountRef.current = curr
      return
    }

    lastMessageCountRef.current = curr
  }, [messages])

  // Monitor scroll position to hide/show jump button
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    
    const handleScroll = () => {
      if (isNearBottomEl(container)) {
        setShowJumpToNewest(false)
        setUnreadCount(0)
      }
      
      // Track if user is actively scrolling
      isUserScrollingRef.current = true
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false
      }, 150)
    }
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [selectedThread?.id])

  const scrollToBottom = () => {
    // Use both smooth and instant scroll as fallback
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
      } catch {
        // Fallback to instant scroll if smooth fails
        messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" })
      }
    }
    // Hide jump button when manually scrolling to bottom
    setShowJumpToNewest(false)
    setUnreadCount(0)
  }
  
  const handleJumpToNewest = () => {
    scrollToBottom()
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
      setSelectedThread((prev) => {
        if (!prev) return prev
        const match = data.find((t: Thread) => t.id === prev.id)
        if (!match) return prev
        return { ...match, messages: prev.messages }
      })

      // Check for threadId in URL params (from notification deep link)
      const urlThreadId = searchParams?.get("threadId")
      
      if (urlThreadId && !urlThreadIdProcessedRef.current) {
        // Find thread by ID from URL
        const threadFromUrl = data.find((t: Thread) => t.id === urlThreadId)
        if (threadFromUrl) {
          setSelectedThread(threadFromUrl)
          setMobileShowList(false)
          urlThreadIdProcessedRef.current = true
        } else {
          // Thread not found, might not be loaded yet or user doesn't have access
          // This is handled by role-based access in the API
          console.warn(`Thread ${urlThreadId} not found or access denied`)
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

  const handleModerateMessage = async (messageId: string) => {
    if (!selectedThread?.id) return
    if (!window.confirm("Remove this message for all participants?")) return
    try {
      const res = await fetch("/api/messages/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Moderation failed")
      }
      await loadMessages(selectedThread.id, false)
      await loadThreads()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove message"
      alert(msg)
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
      
      // Update messages state - ensure proper sorting
      const sortedMessages = (data.messages || []).sort((a: Message, b: Message) => {
        const aTime = new Date(a.createdAt).getTime()
        const bTime = new Date(b.createdAt).getTime()
        return aTime - bTime
      })
      if (showLoading) {
        messageIngressRef.current = "full-load"
      }
      setMessages(sortedMessages)
      
      // Update selectedThread metadata only if it's missing or different
      setSelectedThread(prev => {
        if (!prev || prev.id !== threadId) {
          return { ...data, canModerate: data.canModerate === true }
        }
        return {
          ...prev,
          ...data,
          canModerate: data.canModerate === true,
          messages: sortedMessages,
        }
      })
      
      setError(null)
      
      // Mark thread as read when messages are loaded
      if (showLoading) {
        // Mark as read in background (non-blocking)
        fetch(`/api/messages/threads/${threadId}/read`, { method: "POST" })
          .catch(err => console.error("Error marking thread as read:", err))
      }
      
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
    {
      const c = messagesContainerRef.current
      scrollIntentAfterNextMessagesRef.current =
        c && isNearBottomEl(c) ? "bottom" : "keep"
    }
    try {
      // Fetch latest messages without showing loading spinner
      const response = await fetch(`/api/messages/threads/${threadId}`)
      if (response.ok) {
        const data = await response.json()

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id))
          const newMessages = (data.messages || []).filter((m: Message) => !existingIds.has(m.id))

          if (newMessages.length === 0) {
            const allIds = new Set(data.messages?.map((m: Message) => m.id) || [])
            return prev
              .filter((m) => allIds.has(m.id))
              .sort((a, b) => {
                const aTime = new Date(a.createdAt).getTime()
                const bTime = new Date(b.createdAt).getTime()
                return aTime - bTime
              })
          }

          messageIngressRef.current = "poll"

          const merged = [...prev, ...newMessages]
          return merged.sort((a, b) => {
            const aTime = new Date(a.createdAt).getTime()
            const bTime = new Date(b.createdAt).getTime()
            return aTime - bTime
          })
        })
      }
      
      // Refresh thread list to update last message timestamps (non-blocking)
      loadThreads().catch(err => console.error("Error refreshing threads:", err))
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
          const newMessageId = payload.new.id as string

          if (optimisticMessageIdRef.current === newMessageId) {
            optimisticMessageIdRef.current = null
            return
          }

          const senderId = payload.new.sender_id as string
          const content = payload.new.content as string
          const createdAt = payload.new.created_at as string

          {
            const c = messagesContainerRef.current
            scrollIntentAfterNextMessagesRef.current =
              c && isNearBottomEl(c) ? "bottom" : "keep"
          }

          const appendRealtimeMessage = (newMessage: Message) => {
            messageIngressRef.current = "realtime"
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id))
              if (existingIds.has(newMessageId)) return prev
              return [...prev, newMessage].sort((a, b) => {
                const aTime = new Date(a.createdAt).getTime()
                const bTime = new Date(b.createdAt).getTime()
                return aTime - bTime
              })
            })
          }

          try {
            const senderResponse = await fetch(`/api/messages/sender/${senderId}`)
            const senderData = senderResponse.ok ? await senderResponse.json() : null

            const newMessage: Message = {
              id: newMessageId,
              body: content,
              attachments: [],
              createdAt: new Date(createdAt),
              creator: senderData || { id: senderId, name: null, email: "" },
            }

            appendRealtimeMessage(newMessage)
          } catch (err) {
            console.error("Error fetching sender info for realtime message:", err)
            appendRealtimeMessage({
              id: newMessageId,
              body: content,
              attachments: [],
              createdAt: new Date(createdAt),
              creator: { id: senderId, name: null, email: "" },
            })
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

    scrollIntentAfterNextMessagesRef.current = "bottom"
    messageIngressRef.current = "optimistic"
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

      scrollIntentAfterNextMessagesRef.current = "bottom"
      messageIngressRef.current = "user-send"

      // Update messages state atomically
      setMessages(prev => {
        // Remove optimistic message
        const filtered = prev.filter(m => m.id !== tempId)
        
        // Check if message already exists (from realtime or previous update)
        const exists = filtered.some(m => m.id === newMessage.id)
        if (exists) {
          // Message already exists, just ensure it's properly formatted
          return filtered.map(m => 
            m.id === newMessage.id ? newMessage : m
          )
        }
        
        // Add new message and sort
        const updated = [...filtered, newMessage]
        return updated.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime()
          const bTime = new Date(b.createdAt).getTime()
          return aTime - bTime
        })
      })

      // Refresh thread list to update last message (non-blocking)
      loadThreads().catch(err => console.error("Error refreshing threads:", err))
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
      setComposeGroupFilter(null)
      setError(null)
      setMobileShowList(false)
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
    const otherParticipants = thread.participants
      .filter((p) => p.user.id !== userId)
      .map((p) => displayNameForParticipantUser(p.user))
    return otherParticipants.join(", ") || "New Thread"
  }

  const threadCategoryLabel = (thread: Thread) => {
    const t = thread.threadType
    if (t === "GENERAL") return "Team"
    if (t === "GROUP" || t === "group") return "Group"
    const other = thread.participants.find((p) => p.user.id !== userId)
    if (other?.participantKind === "player") return "Player"
    if (other?.participantKind === "parent") return "Parent"
    if (other?.participantKind === "coach" || other?.participantKind === "staff") return "Staff"
    return "Chat"
  }

  const primaryThreadPeer = (thread: Thread) => {
    const others = thread.participants.filter((p) => p.user.id !== userId)
    if (others.length === 1) return others[0]
    return null
  }

  const toggleThreadStar = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setStarredThreadIds((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      try {
        localStorage.setItem(starredStorageKey(userId, teamId), JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const sortedThreadSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = q
      ? threads.filter((thread) => {
          const displayName = getThreadDisplayName(thread).toLowerCase()
          const lastMessage = thread.messages[0]?.body?.toLowerCase() || ""
          return displayName.includes(q) || lastMessage.includes(q)
        })
      : threads

    const byUpdated = (a: Thread, b: Thread) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

    const starred = base.filter((t) => starredThreadIds.has(t.id)).sort(byUpdated)
    const rest = base.filter((t) => !starredThreadIds.has(t.id)).sort(byUpdated)
    return { starred, rest }
  }, [threads, searchQuery, starredThreadIds])

  const getFilteredContacts = () => {
    if (!threadType) return contacts

    if (threadType === "group" && composeGroupFilter === "staff") {
      return contacts.filter((c) => {
        const typeUpper = (c.type || "").toUpperCase()
        return typeUpper !== "PLAYER" && typeUpper !== "PARENT"
      })
    }

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

  const handleCancelCreate = () => {
    setShowCreateThread(false)
    setThreadType(null)
    setComposeGroupFilter(null)
    setNewThreadSubject("")
    setSelectedContacts([])
  }

  const openComposeCategory = (type: "coach" | "player" | "parent" | "group") => {
    setComposeGroupFilter(null)
    setThreadType(type)
    setShowCreateThread(true)
    setSelectedContacts([])
    setNewThreadSubject("")
  }

  const openStaffCompose = () => {
    setComposeGroupFilter("staff")
    setThreadType("group")
    setShowCreateThread(true)
    setSelectedContacts([])
    setNewThreadSubject("")
  }

  const avatarClassForKind = (kind?: ParticipantKind) => {
    switch (kind) {
      case "player":
        return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80"
      case "parent":
        return "bg-violet-100 text-violet-800 ring-1 ring-violet-200/80"
      case "coach":
      case "staff":
        return "bg-orange-100 text-orange-900 ring-1 ring-orange-200/80"
      default:
        return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80"
    }
  }

  const renderThreadCard = (thread: Thread) => {
    const isSelected = selectedThread?.id === thread.id
    const lastMessage = thread.messages[0]
    const isReadOnly = thread.isReadOnly || false
    const peer = primaryThreadPeer(thread)
    const peerName = peer ? displayNameForParticipantUser(peer.user) : getThreadDisplayName(thread)
    const peerKind = peer?.participantKind
    const initials = initialsFromDisplayName(peerName)
    const starred = starredThreadIds.has(thread.id)
    const unread = (thread.unreadCount ?? 0) > 0

    return (
      <div
        key={thread.id}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setSelectedThread(thread)
            setMobileShowList(false)
          }
        }}
        onClick={() => {
          setSelectedThread(thread)
          setMobileShowList(false)
        }}
        className={cn(
          "relative mx-3 mb-3 cursor-pointer rounded-2xl border p-4 text-left shadow-sm transition-all md:mx-4 md:mb-3 md:p-4 lg:rounded-2xl lg:p-4",
          isSelected ? "border-[rgb(var(--accent))] bg-[rgb(var(--platinum))] ring-1 ring-[rgb(var(--accent))]/25" : "border-[rgb(var(--border))] bg-white hover:border-[rgb(var(--accent))]/40"
        )}
        style={{ borderColor: isSelected ? undefined : "rgb(var(--border))" }}
      >
        <button
          type="button"
          aria-label={starred ? "Remove from priority" : "Mark as priority"}
          className="absolute right-3 top-3 rounded-full p-1.5 text-[rgb(var(--muted))] transition hover:bg-black/5 hover:text-[rgb(var(--accent))]"
          onClick={(e) => toggleThreadStar(thread.id, e)}
        >
          <Star
            className={cn("h-5 w-5", starred && "fill-amber-400 text-amber-500")}
            strokeWidth={starred ? 0 : 1.75}
          />
        </button>
        <div className="flex gap-3 pr-10">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
              avatarClassForKind(peerKind)
            )}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate pr-2 text-[15px] font-semibold leading-tight text-[rgb(var(--text))]">
                {getThreadDisplayName(thread)}
              </h3>
            </div>
            {lastMessage ? (
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-[rgb(var(--text2))]">
                <span className="font-medium text-[rgb(var(--text))]">
                  {lastMessage.creator.name || lastMessage.creator.email}:
                </span>{" "}
                {lastMessage.body}
              </p>
            ) : (
              <p className="mt-1 text-sm italic text-[rgb(var(--muted))]">No messages yet</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600"
              >
                {threadCategoryLabel(thread)}
              </span>
              {isReadOnly && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-[rgb(var(--muted))]">
                  <Lock className="h-3 w-3" /> Read-only
                </span>
              )}
              {unread && (
                <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[rgb(var(--accent))] px-2 py-0.5 text-[11px] font-semibold text-white">
                  {(thread.unreadCount ?? 0) > 9 ? "9+" : thread.unreadCount}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
              <span className="truncate font-medium text-[rgb(var(--text2))]">{peerName}</span>
              <time className="shrink-0 tabular-nums">{format(new Date(thread.updatedAt), "MMM d, h:mm a")}</time>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (initialLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center rounded-lg border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  return (
    <div
      className="relative flex h-[calc(100dvh-12rem)] min-h-[560px] flex-col overflow-hidden rounded-[18px] border border-border bg-white shadow-[0_2px_14px_rgba(15,23,42,0.08)] lg:flex-row"
    >
      {error && (
        <div className="absolute left-1/2 top-4 z-50 max-w-md -translate-x-1/2 transform rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-600 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-col border-b lg:h-full lg:w-[min(100%,22rem)] lg:max-w-md lg:flex-none lg:border-b-0 lg:border-r",
          !isWide && selectedThread && !mobileShowList ? "hidden" : "flex-1 lg:flex-none"
        )}
        style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
      >
        <div
          className="flex flex-shrink-0 items-center justify-between border-b px-4 py-4 md:px-5"
          style={{ borderBottomColor: "rgb(var(--border))" }}
        >
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
              Messages
            </h2>
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              Inbox & conversations
            </p>
          </div>
        </div>

        {announcementPreview.length > 0 && (
          <div
            className="max-h-48 flex-shrink-0 overflow-y-auto border-b px-4 py-3 md:px-5"
            style={{ borderBottomColor: "rgb(var(--border))", backgroundColor: "rgb(var(--snow))" }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
                <Megaphone className="h-4 w-4 shrink-0 text-[rgb(var(--accent))]" aria-hidden />
                Announcements
              </div>
              <Link
                href="/dashboard/announcements"
                className="shrink-0 text-xs font-medium text-[rgb(var(--accent))] hover:underline"
              >
                {canPostAnnouncements(userRole as any) ? "Manage" : "View all"}
              </Link>
            </div>
            <ul className="space-y-2">
              {announcementPreview.map((a) => (
                <li key={a.id} className="rounded-lg border border-[rgb(var(--border))] bg-white px-3 py-2 text-xs shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold leading-snug text-[rgb(var(--text))]">{a.title}</span>
                    {a.is_pinned ? (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 leading-snug text-[rgb(var(--text2))]">{a.body}</p>
                  <p className="mt-1 text-[10px] text-[rgb(var(--muted))]">
                    {formatAnnouncementDateTime(a.created_at)}
                    {a.author_name ? ` · ${a.author_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canCreateThread && (
          <div className="border-b px-3 py-3 md:px-4 md:py-4" style={{ borderBottomColor: "rgb(var(--border))" }}>
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--muted))] md:text-left">
              Start a conversation
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:gap-3">
              <button
                type="button"
                onClick={() => openComposeCategory("player")}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-white px-2 py-3 text-center shadow-sm transition hover:border-[rgb(var(--accent))]/50 hover:shadow md:min-h-[56px]"
              >
                <UserRound className="h-5 w-5 text-emerald-600" aria-hidden />
                <span className="text-xs font-semibold text-[rgb(var(--text))]">Players</span>
              </button>
              <button
                type="button"
                onClick={() => openComposeCategory("coach")}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-white px-2 py-3 text-center shadow-sm transition hover:border-[rgb(var(--accent))]/50 hover:shadow md:min-h-[56px]"
              >
                <Shield className="h-5 w-5 text-orange-600" aria-hidden />
                <span className="text-xs font-semibold text-[rgb(var(--text))]">Coaches</span>
              </button>
              <button
                type="button"
                onClick={() => openComposeCategory("parent")}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-white px-2 py-3 text-center shadow-sm transition hover:border-[rgb(var(--accent))]/50 hover:shadow md:min-h-[56px]"
              >
                <Heart className="h-5 w-5 text-violet-600" aria-hidden />
                <span className="text-xs font-semibold text-[rgb(var(--text))]">Parents</span>
              </button>
              <button
                type="button"
                onClick={() => openStaffCompose()}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-white px-2 py-3 text-center shadow-sm transition hover:border-[rgb(var(--accent))]/50 hover:shadow md:min-h-[56px]"
              >
                <UsersRound className="h-5 w-5 text-slate-600" aria-hidden />
                <span className="text-xs font-semibold text-[rgb(var(--text))]">Staff</span>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] leading-snug text-[rgb(var(--muted))] md:text-left">
              Staff opens a group chat with coaches & team staff (multi-select).
            </p>
          </div>
        )}

        {!canCreateThread && (
          <div className="border-b px-4 py-3 text-center text-sm md:text-left" style={{ borderBottomColor: "rgb(var(--border))" }}>
            <p style={{ color: "rgb(var(--muted))" }}>
              Your coaches manage new threads. You can reply in conversations you are added to.
            </p>
          </div>
        )}

        <div className="flex-shrink-0 border-b px-4 py-3 md:px-5" style={{ borderBottomColor: "rgb(var(--border))" }}>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform"
              style={{ color: "rgb(var(--muted))" }}
            />
            <Input
              type="search"
              placeholder="Search threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            />
          </div>
        </div>

        {showCreateThread && threadType && (
          <div className="flex-shrink-0 border-b px-4 py-4" style={{ backgroundColor: "rgb(var(--platinum))", borderBottomColor: "rgb(var(--border))" }}>
            <div className="space-y-3">
              {composeGroupFilter === "staff" && (
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  Choose one or more staff members for this group.
                </p>
              )}
              {threadType === "group" && (
                <div>
                  <Label className="text-xs" style={{ color: "rgb(var(--text))" }}>
                    Group name
                  </Label>
                  <Input
                    value={newThreadSubject}
                    onChange={(e) => setNewThreadSubject(e.target.value)}
                    placeholder={composeGroupFilter === "staff" ? "e.g. Staff coordination" : "Enter group name"}
                    className="mt-1 h-9 rounded-xl text-sm"
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
                  {threadType === "group"
                    ? composeGroupFilter === "staff"
                      ? "Select staff"
                      : "Select members"
                    : `Select ${threadType.charAt(0).toUpperCase() + threadType.slice(1)}`}
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setParticipantsModalPurpose("pick")
                    setShowParticipantsModal(true)
                  }}
                  className="mt-1 w-full justify-start rounded-xl"
                  style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  {selectedContacts.length > 0
                    ? threadType === "group"
                      ? `${selectedContacts.length} member${selectedContacts.length !== 1 ? "s" : ""} selected`
                      : contacts.find((c) => c.id === selectedContacts[0])?.name || "Selected"
                    : `Choose ${threadType === "group" ? "people" : "someone"}`}
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
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleCreateThread}
                  disabled={
                    loading ||
                    (threadType === "group" && !newThreadSubject.trim()) ||
                    selectedContacts.length === 0 ||
                    (threadType !== "group" && selectedContacts.length !== 1)
                  }
                  className="rounded-xl"
                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelCreate}
                  className="rounded-xl"
                  style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="messages-thread-list min-h-0 flex-1 overflow-y-auto py-3 md:py-4">
          {threads.length === 0 ? (
            <div className="mx-4 rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--platinum))]/40 px-4 py-10 text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 text-[rgb(var(--accent))]" aria-hidden />
              <p className="text-sm font-medium text-[rgb(var(--text))]">No conversations yet</p>
              <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--muted))]">
                {canCreateThread
                  ? "Use the buttons above to message players, coaches, parents, or staff."
                  : "When your team adds you to a thread, it will show up here."}
              </p>
            </div>
          ) : (
            <>
              {sortedThreadSections.starred.length > 0 && (
                <div className="mb-1">
                  <button
                    type="button"
                    onClick={() => setPriorityCollapsed((c) => !c)}
                    className="sticky top-0 z-[1] mb-2 flex w-full items-center justify-between bg-white/95 px-4 py-2 text-left backdrop-blur-sm md:px-5"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[rgb(var(--muted))]">
                      Priority · Starred
                    </span>
                    <span className="text-xs text-[rgb(var(--accent))]">{priorityCollapsed ? "Show" : "Hide"}</span>
                  </button>
                  {!priorityCollapsed && sortedThreadSections.starred.map((t) => renderThreadCard(t))}
                </div>
              )}
              <div className="mt-1">
                {sortedThreadSections.rest.length > 0 && (
                  <h3 className="sticky top-0 z-[1] mb-2 bg-white/95 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[rgb(var(--muted))] backdrop-blur-sm md:px-5">
                    All threads
                  </h3>
                )}
                {sortedThreadSections.rest.map((t) => renderThreadCard(t))}
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          !isWide && (!selectedThread || mobileShowList) ? "hidden" : ""
        )}
      >
        {selectedThread ? (
          <>
            <div className="flex-shrink-0 border-b px-3 py-3 md:px-5 md:py-4" style={{ borderBottomColor: "rgb(var(--border))" }}>
              <div className="flex items-start gap-2 md:items-center md:justify-between">
                {!isWide && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-0.5 h-9 shrink-0 px-2"
                    aria-label="Back to threads"
                    onClick={() => {
                      setMobileShowList(true)
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold leading-tight" style={{ color: "rgb(var(--text))" }}>
                    {getThreadDisplayName(selectedThread)}
                    {selectedThread.isReadOnly && (
                      <span className="ml-2 text-xs font-normal" style={{ color: "rgb(var(--muted))" }}>
                        (Read-only)
                      </span>
                    )}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600"
                    >
                      {threadCategoryLabel(selectedThread)}
                    </span>
                    <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                      {selectedThread.participants.length} participant
                      {selectedThread.participants.length !== 1 ? "s" : ""}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setParticipantsModalPurpose("view")
                        setShowParticipantsModal(true)
                      }}
                      className="h-7 px-2 text-xs"
                      style={{ color: "rgb(var(--accent))" }}
                    >
                      <Users className="mr-1 h-3 w-3" />
                      People
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleManualRefresh}
                  disabled={refreshing || messagesLoading}
                  className="h-9 w-9 shrink-0 p-0"
                  title="Refresh messages"
                  style={{ color: "rgb(var(--accent))" }}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={messagesContainerRef}
                className="messages-container min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5"
              >
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
                const removed = message.isRemoved === true
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl p-3 ${
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
                      <p className={`text-sm whitespace-pre-wrap ${removed ? "italic opacity-90" : ""}`}>{message.body}</p>
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
                      <div className={`mt-2 flex items-center justify-between gap-2 ${isOwnMessage ? "opacity-80" : ""}`}>
                        <p className="text-xs">
                          {message.creator.name || message.creator.email} • {format(new Date(message.createdAt), "h:mm a")}
                        </p>
                        {selectedThread?.canModerate && !removed && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs shrink-0"
                            onClick={() => handleModerateMessage(message.id)}
                            title="Remove message"
                            style={isOwnMessage ? { color: "rgba(255,255,255,0.9)" } : { color: "rgb(var(--accent))" }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }))}
              <div ref={messagesEndRef} />
            </div>
            {showJumpToNewest && (
              <div className="pointer-events-none absolute bottom-3 right-4 z-20 md:bottom-4 md:right-5">
                <Button
                  type="button"
                  onClick={handleJumpToNewest}
                  size="sm"
                  className="pointer-events-auto rounded-full px-4 py-2 shadow-lg"
                  style={{
                    backgroundColor: "rgb(var(--accent))",
                    color: "white",
                  }}
                >
                  <ArrowDown className="mr-2 inline h-4 w-4 align-middle" />
                  {unreadCount > 0
                    ? `${unreadCount} new message${unreadCount !== 1 ? "s" : ""}`
                    : "Jump to latest"}
                </Button>
              </div>
            )}
            </div>

            {/* Message Input */}
            {!selectedThread.isReadOnly && (
              <div className="flex-shrink-0 border-t bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]" style={{ borderTopColor: "rgb(var(--border))" }}>
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
                <div className="flex items-end gap-2">
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
                    className="mobile-textarea max-h-40 min-h-[44px] flex-1 resize-none"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={loading || !messageBody.trim()}
                    className="h-11 min-w-[44px] rounded-xl"
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

      <Dialog
        open={showParticipantsModal}
        onOpenChange={(open) => {
          setShowParticipantsModal(open)
          if (!open) setParticipantsModalPurpose("pick")
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {participantsModalPurpose === "view"
                ? "People in this thread"
                : threadType === "group"
                  ? composeGroupFilter === "staff"
                    ? "Select staff members"
                    : "Select group members"
                  : `Select ${threadType ? threadType.charAt(0).toUpperCase() + threadType.slice(1) : "someone"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {participantsModalPurpose === "view" && selectedThread ? (
              <div className="messages-thread-list max-h-96 space-y-2 overflow-y-auto">
                {selectedThread.participants.map((p) => {
                  const name = displayNameForParticipantUser(p.user)
                  const initials = initialsFromDisplayName(name)
                  return (
                    <div
                      key={p.userId}
                      className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] p-3"
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                          avatarClassForKind(p.participantKind)
                        )}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[rgb(var(--text))]">{name}</p>
                        <p className="truncate text-xs text-[rgb(var(--muted))]">{p.user.email}</p>
                      </div>
                      {p.participantKind && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          {p.participantKind}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="messages-thread-list max-h-96 space-y-2 overflow-y-auto">
                {getFilteredContacts().length === 0 ? (
                  <p className="py-4 text-center text-sm" style={{ color: "rgb(var(--muted))" }}>
                    {threadType ? `No ${threadType}s available` : "No contacts available"}
                  </p>
                ) : (
                  getFilteredContacts().map((contact) => (
                    <label
                      key={contact.id}
                      className="flex cursor-pointer items-center space-x-3 rounded-xl p-2 hover:bg-gray-100"
                    >
                      <input
                        type={threadType === "group" ? "checkbox" : "radio"}
                        name={threadType === "group" ? undefined : "participant"}
                        checked={selectedContacts.includes(contact.id)}
                        onChange={(e) => {
                          if (threadType === "group") {
                            if (e.target.checked) {
                              setSelectedContacts([...selectedContacts, contact.id])
                            } else {
                              setSelectedContacts(selectedContacts.filter((id) => id !== contact.id))
                            }
                          } else if (e.target.checked) {
                            setSelectedContacts([contact.id])
                          }
                        }}
                        className="h-4 w-4"
                        style={{ accentColor: "rgb(var(--accent))" }}
                      />
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
                            avatarClassForKind(
                              contact.type?.toUpperCase() === "PLAYER"
                                ? "player"
                                : contact.type?.toUpperCase() === "PARENT"
                                  ? "parent"
                                  : "coach"
                            )
                          )}
                        >
                          {initialsFromDisplayName(contact.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                            {contact.name}
                          </p>
                          <p className="truncate text-xs" style={{ color: "rgb(var(--muted))" }}>
                            {contact.email} · {contact.role}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}
            <div className="flex gap-2 border-t pt-4" style={{ borderTopColor: "rgb(var(--border))" }}>
              <Button
                onClick={() => {
                  setShowParticipantsModal(false)
                  if (
                    participantsModalPurpose === "pick" &&
                    threadType !== "group" &&
                    selectedContacts.length === 0
                  ) {
                    handleCancelCreate()
                  }
                }}
                variant="outline"
                className="rounded-xl"
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
