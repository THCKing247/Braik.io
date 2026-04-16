"use client"

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { dashboardBootstrapQueryKey } from "@/lib/dashboard/dashboard-bootstrap-query"
import { useMessagingUnreadOptional } from "@/components/portal/messaging-unread-context"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format, isToday, isYesterday } from "date-fns"
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
  Trash2,
  LayoutGrid,
} from "lucide-react"
import { getMessagingPermissions } from "@/lib/enforcement/messaging-permissions"
import { supabase } from "@/lib/supabaseClient"
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

/** Hide scrollbars while keeping scroll (Messages module only). */
const msgScrollHide =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"

function messageDayKey(d: Date | string) {
  return format(new Date(d), "yyyy-MM-dd")
}

function messageDaySeparatorLabel(d: Date | string) {
  const date = new Date(d)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMMM d, yyyy")
}

function messageAttachmentIsImage(att: { mimeType?: string; fileName?: string }) {
  if (att.mimeType && att.mimeType.startsWith("image/")) return true
  const n = (att.fileName || "").toLowerCase()
  return /\.(webp|png|jpe?g|gif|bmp|avif)$/i.test(n)
}

interface Contact {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  type: string
  /** Player position group (e.g. WR, OL); null for non-players */
  positionGroup: string | null
}

interface MessagingManagerProps {
  teamId: string
  userRole: string
  userId: string
  initialThreads?: Thread[]
}

export function MessagingManager({ teamId, userRole, userId, initialThreads = [] }: MessagingManagerProps) {
  const searchParams = useSearchParams()
  const shell = useAppBootstrapOptional()
  const messagingUnread = useMessagingUnreadOptional()
  const searchParamsRef = useRef(searchParams)
  searchParamsRef.current = searchParams
  const messagingUnreadRef = useRef(messagingUnread)
  messagingUnreadRef.current = messagingUnread
  const queryClient = useQueryClient()
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
  const [threadType, setThreadType] = useState<"all" | "player" | "parent" | "group" | null>(null)
  const [newThreadSubject, setNewThreadSubject] = useState("")
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const realtimeSubscriptionRef = useRef<any>(null)
  const optimisticMessageIdRef = useRef<string | null>(null)
  const isRefreshingRef = useRef<boolean>(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showJumpToNewest, setShowJumpToNewest] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const isUserScrollingRef = useRef<boolean>(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const urlThreadIdProcessedRef = useRef<boolean>(false)
  const contactsFetchStartedRef = useRef(false)
  const selectedThreadIdRef = useRef<string | null>(null)
  const [starredThreadIds, setStarredThreadIds] = useState<Set<string>>(new Set())
  const [isWide, setIsWide] = useState(false)
  const [mobileShowList, setMobileShowList] = useState(true)
  const [composeGroupFilter, setComposeGroupFilter] = useState<null | "coachStaff">(null)
  /** Narrow player list by roster position group; omit non-players when set */
  const [contactPositionFilter, setContactPositionFilter] = useState<string | null>(null)
  const [participantsModalPurpose, setParticipantsModalPurpose] = useState<"pick" | "view">("pick")
  const [priorityCollapsed, setPriorityCollapsed] = useState(false)
  const messageIngressRef = useRef<"idle" | "full-load" | "poll" | "realtime" | "user-send" | "optimistic">("idle")
  const scrollIntentAfterNextMessagesRef = useRef<"bottom" | "keep">("keep")
  const lastMessageCountRef = useRef<number>(0)
  /** Dedupe: last message id that triggered the in-thread “new messages” banner (jump pill). */
  const lastBannerMessageIdRef = useRef<string | null>(null)
  /** Snapshot for rollback if POST /read fails after optimistic UI. */
  const optimisticReadRef = useRef<{ threadId: string; prevUnread: number } | null>(null)
  const isLoadingRef = useRef(false)

  const logThreadMessageBanner = useCallback(
    (
      event: "show" | "clear",
      reason: string,
      detail?: { threadId?: string | null; messageId?: string | null }
    ) => {
      console.info(`[messaging:thread-banner] ${event}`, {
        reason,
        userId,
        threadId: detail?.threadId ?? selectedThreadIdRef.current ?? null,
        messageId: detail?.messageId ?? null,
        at: new Date().toISOString(),
      })
    },
    [userId]
  )

  const permissions = getMessagingPermissions(userRole as any)
  const canCreateThread = permissions.canCreateThread()

  const isThreadActivelyViewed = useCallback((threadId: string) => {
    if (typeof document === "undefined") return false
    return (
      selectedThreadIdRef.current === threadId &&
      document.visibilityState === "visible" &&
      (typeof document.hasFocus !== "function" || document.hasFocus())
    )
  }, [])

  /** Contacts are only needed for compose / participant picker — lazy load on first use. */
  useEffect(() => {
    const needsContacts =
      (showCreateThread && threadType !== null) ||
      (showParticipantsModal && participantsModalPurpose === "pick")
    if (!needsContacts || contactsFetchStartedRef.current) return
    contactsFetchStartedRef.current = true
    void loadContacts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateThread, threadType, showParticipantsModal, participantsModalPurpose])

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

  useEffect(() => {
    selectedThreadIdRef.current = selectedThread?.id ?? null
  }, [selectedThread?.id])

  // Load messages only when threadId changes (not when selectedThread object changes)
  useEffect(() => {
    const threadId = selectedThread?.id
    if (threadId) {
      lastMessageCountRef.current = 0
      lastBannerMessageIdRef.current = null
      setShowJumpToNewest(false)
      setUnreadCount(0)
      logThreadMessageBanner("clear", "thread_changed", { threadId })
      loadMessages(threadId)
    } else {
      setMessages([])
      lastBannerMessageIdRef.current = null
      setShowJumpToNewest(false)
      setUnreadCount(0)
      logThreadMessageBanner("clear", "no_thread_selected", {})
      // Cleanup subscription when no thread selected
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe()
        realtimeSubscriptionRef.current = null
      }
    }
    // Cleanup: unsubscribe from previous thread's realtime
    return () => {
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe()
        realtimeSubscriptionRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, logThreadMessageBanner]) // Only depend on threadId, not the whole object

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
      lastBannerMessageIdRef.current = null
      logThreadMessageBanner("clear", "full_load", { threadId: selectedThreadIdRef.current })
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
        lastBannerMessageIdRef.current = null
        logThreadMessageBanner("clear", "user_send_near_bottom", { threadId: selectedThreadIdRef.current })
      } else {
        setShowJumpToNewest(true)
        setUnreadCount((u) => u + delta)
        logThreadMessageBanner("show", "user_send_while_scrolled_up", { threadId: selectedThreadIdRef.current })
      }
      lastMessageCountRef.current = curr
      return
    }

    if (ingress === "poll" || ingress === "realtime") {
      const tid = selectedThreadIdRef.current
      const newSlice = delta > 0 ? messages.slice(-delta) : []
      const hasIncomingFromOthers = newSlice.some((m) => m.creator.id !== userId)

      /** Open + focused: never show the jump / “new messages” pill for realtime/poll (read path marks the thread). */
      if (tid && isThreadActivelyViewed(tid)) {
        if (intent === "bottom") {
          scrollToEndInstant()
        }
        setShowJumpToNewest(false)
        setUnreadCount(0)
        lastBannerMessageIdRef.current = null
        const lastIncoming = [...newSlice].reverse().find((m) => m.creator.id !== userId)
        logThreadMessageBanner("clear", "active_focused_thread", {
          threadId: tid,
          messageId: lastIncoming?.id ?? newSlice[newSlice.length - 1]?.id,
        })
        lastMessageCountRef.current = curr
        return
      }

      if (!hasIncomingFromOthers) {
        lastMessageCountRef.current = curr
        logThreadMessageBanner("clear", "own_messages_only_no_banner", {
          threadId: tid,
          messageId: newSlice[newSlice.length - 1]?.id,
        })
        return
      }

      if (intent === "bottom") {
        scrollToEndInstant()
        setShowJumpToNewest(false)
        setUnreadCount(0)
        lastBannerMessageIdRef.current = null
        logThreadMessageBanner("clear", "poll_or_realtime_intent_bottom", { threadId: tid })
      } else {
        const lastIncoming = [...newSlice].reverse().find((m) => m.creator.id !== userId)
        const bannerMsgId = lastIncoming?.id ?? newSlice[newSlice.length - 1]?.id
        if (bannerMsgId && lastBannerMessageIdRef.current === bannerMsgId) {
          lastMessageCountRef.current = curr
          return
        }
        if (bannerMsgId) lastBannerMessageIdRef.current = bannerMsgId
        setShowJumpToNewest(true)
        setUnreadCount((u) => u + delta)
        logThreadMessageBanner("show", "incoming_while_scrolled_up_background_tab", {
          threadId: tid ?? undefined,
          messageId: bannerMsgId,
        })
      }
      lastMessageCountRef.current = curr
      return
    }

    lastMessageCountRef.current = curr
  }, [messages, isThreadActivelyViewed, logThreadMessageBanner, userId])

  // Monitor scroll position to hide/show jump button
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    
    const handleScroll = () => {
      if (isNearBottomEl(container)) {
        setShowJumpToNewest(false)
        setUnreadCount(0)
        lastBannerMessageIdRef.current = null
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
    lastBannerMessageIdRef.current = null
    logThreadMessageBanner("clear", "user_jump_to_newest_click", { threadId: selectedThreadIdRef.current })
  }
  
  const handleJumpToNewest = () => {
    scrollToBottom()
  }

  const loadThreads = useCallback(
    async (opts?: { skipMessagingBadgeSync?: boolean }) => {
      if (isLoadingRef.current) return
      isLoadingRef.current = true
      try {
        const response = await fetch(`/api/messages/threads?teamId=${teamId}`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to load threads")
        }
        const raw = await response.json()
        const data: Thread[] = Array.isArray(raw) ? raw : ((raw as { threads?: Thread[] }).threads ?? [])
        const meta = Array.isArray(raw) ? null : (raw as { meta?: { totalUnread?: number } }).meta
        const mu = messagingUnreadRef.current
        if (typeof meta?.totalUnread === "number" && !opts?.skipMessagingBadgeSync) {
          mu?.syncThreadUnreadFromServer(meta.totalUnread)
        }
        setThreads((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev
          return data
        })
        setSelectedThread((prev) => {
          if (!prev) return prev
          const match = data.find((t: Thread) => t.id === prev.id)
          if (!match) return prev
          return { ...match, messages: prev.messages }
        })

        // Check for threadId in URL params (from notification deep link)
        const urlThreadId = searchParamsRef.current?.get("threadId")

        if (urlThreadId && !urlThreadIdProcessedRef.current) {
          const threadFromUrl = data.find((t: Thread) => t.id === urlThreadId)
          if (threadFromUrl) {
            setSelectedThread(threadFromUrl)
            setMobileShowList(false)
            urlThreadIdProcessedRef.current = true
          } else {
            console.warn(`Thread ${urlThreadId} not found or access denied`)
          }
        }
        setError(null)
      } catch (error: unknown) {
        console.error("Error loading threads:", error)
        const msg = error instanceof Error ? error.message : "Failed to load threads"
        setError(msg)
      } finally {
        isLoadingRef.current = false
        setInitialLoading(false)
      }
    },
    [teamId]
  )

  useEffect(() => {
    if (!teamId) return
    loadThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadThreads is [teamId]-scoped
  }, [teamId])

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

  /** Update inbox row preview from a thread detail payload (avoids refetching the full thread list). */
  const patchThreadListFromDetailMessages = (threadId: string, detailMessages: Message[], isViewingThread: boolean) => {
    if (!detailMessages.length) {
      if (!isViewingThread) return
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t))
      )
      return
    }
    const last = detailMessages[detailMessages.length - 1]
    const previewMessages: Message[] = [
      {
        id: last.id,
        body: last.body,
        attachments: Array.isArray(last.attachments) ? last.attachments : [],
        createdAt: last.createdAt instanceof Date ? last.createdAt : new Date(last.createdAt),
        creator: last.creator,
      },
    ]
    setThreads((prev) =>
      prev.map((t) =>
        t.id !== threadId
          ? t
          : {
              ...t,
              updatedAt: new Date(
                last.createdAt instanceof Date ? last.createdAt : new Date(last.createdAt)
              ),
              messages: previewMessages,
              unreadCount: isViewingThread ? 0 : t.unreadCount ?? 0,
              _count: { messages: detailMessages.length },
            }
      )
    )
  }

  const markThreadReadAndSync = useCallback(
    async (threadId: string): Promise<boolean> => {
      const rollback = optimisticReadRef.current
      try {
        const res = await fetch(`/api/messages/threads/${threadId}/read`, { method: "POST" })
        if (!res.ok) {
          if (rollback?.threadId === threadId) {
            setThreads((prev) =>
              prev.map((t) => (t.id === threadId ? { ...t, unreadCount: rollback.prevUnread } : t))
            )
            messagingUnread?.applyThreadUnreadDelta(rollback.prevUnread)
          }
          optimisticReadRef.current = null
          console.error("[messaging] mark-as-read failed", { threadId, status: res.status })
          return false
        }
        optimisticReadRef.current = null
        const data = (await res.json()) as {
          unreadNotifications?: number
          markedNotificationCount?: number
          teamThreadUnread?: number
        }
        if (typeof data.unreadNotifications === "number") {
          shell?.syncUnreadFromServerCount(data.unreadNotifications)
        } else if (typeof data.markedNotificationCount === "number" && data.markedNotificationCount > 0) {
          shell?.applyUnreadDelta(-data.markedNotificationCount)
        }
        const teamTu = data.teamThreadUnread
        if (typeof teamTu === "number") {
          messagingUnread?.syncThreadUnreadFromServer(teamTu)
        }
        queryClient.invalidateQueries({ queryKey: dashboardBootstrapQueryKey(teamId) })
        // removed to stop refetch loop
        return true
      } catch (e) {
        if (rollback?.threadId === threadId) {
          setThreads((prev) =>
            prev.map((t) => (t.id === threadId ? { ...t, unreadCount: rollback.prevUnread } : t))
          )
          messagingUnread?.applyThreadUnreadDelta(rollback.prevUnread)
        }
        optimisticReadRef.current = null
        console.error("markThreadReadAndSync", e)
        return false
      }
    },
    [shell, queryClient, teamId, messagingUnread]
  )

  const resolveRealtimeCreator = (senderId: string): Message["creator"] => {
    if (senderId === userId) {
      const c = contacts.find((x) => x.id === userId)
      return { id: userId, name: c?.name ?? null, email: c?.email ?? "" }
    }
    const p = selectedThread?.participants.find((pp) => pp.userId === senderId)
    if (p) {
      const name =
        (displayNameForParticipantUser(p.user) || p.user.name || p.user.email || "").trim() || null
      return { id: senderId, name, email: p.user.email }
    }
    const c = contacts.find((x) => x.id === senderId)
    if (c) return { id: senderId, name: c.name, email: c.email }
    return { id: senderId, name: null, email: "" }
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
      const refreshed = await loadMessages(selectedThread.id, false)
      if (refreshed?.messages?.length) {
        patchThreadListFromDetailMessages(selectedThread.id, refreshed.messages, true)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove message"
      alert(msg)
    }
  }

  const loadMessages = async (threadId: string, showLoading = true) => {
    if (showLoading) {
      setMessagesLoading(true)
      lastBannerMessageIdRef.current = null
      setShowJumpToNewest(false)
      setUnreadCount(0)
      logThreadMessageBanner("clear", "load_messages_start", { threadId })
      const prevU = threads.find((t) => t.id === threadId)?.unreadCount ?? 0
      optimisticReadRef.current = { threadId, prevUnread: prevU }
      messagingUnread?.applyThreadUnreadDelta(-prevU)
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t))
      )
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
          return { ...data, canModerate: data.canModerate === true, unreadCount: 0 }
        }
        return {
          ...prev,
          ...data,
          canModerate: data.canModerate === true,
          messages: sortedMessages,
          unreadCount: 0,
        }
      })
      
      setError(null)

      if (sortedMessages.length) {
        patchThreadListFromDetailMessages(threadId, sortedMessages, true)
      } else {
        patchThreadListFromDetailMessages(threadId, [], true)
      }

      await markThreadReadAndSync(threadId)
      
      // Setup realtime subscription for this thread (only on initial load)
      if (showLoading) {
        setupRealtimeSubscription(threadId)
      }

      return { messages: sortedMessages as Message[], raw: data }
    } catch (error: any) {
      console.error("Error loading messages:", error)
      if (showLoading) {
        const rb = optimisticReadRef.current
        if (rb?.threadId === threadId) {
          setThreads((prev) =>
            prev.map((t) => (t.id === threadId ? { ...t, unreadCount: rb.prevUnread } : t))
          )
          messagingUnread?.applyThreadUnreadDelta(rb.prevUnread)
          optimisticReadRef.current = null
        }
      }
      setError(error.message || "Failed to load messages")
      return null
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
    const wasNearBottom = messagesContainerRef.current ? isNearBottomEl(messagesContainerRef.current) : false
    try {
      // Fetch latest messages without showing loading spinner
      const response = await fetch(`/api/messages/threads/${threadId}`)
      if (response.ok) {
        const data = await response.json()

        let hadNewFromPoll = false
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id))
          const newMessages = (data.messages || []).filter((m: Message) => !existingIds.has(m.id))
          hadNewFromPoll = newMessages.length > 0

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

        const mergedForPreview = [...(data.messages || [])].sort((a: Message, b: Message) => {
          const aTime = new Date(a.createdAt).getTime()
          const bTime = new Date(b.createdAt).getTime()
          return aTime - bTime
        }) as Message[]
        const viewing = selectedThreadIdRef.current === threadId
        const clearUnreadInList = viewing && (!hadNewFromPoll || wasNearBottom)
        if (mergedForPreview.length) {
          patchThreadListFromDetailMessages(threadId, mergedForPreview, clearUnreadInList)
        }
        if (hadNewFromPoll && wasNearBottom && viewing) {
          void markThreadReadAndSync(threadId)
        }
      }
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
    const subscription = supabase
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

          const newMessage: Message = {
            id: newMessageId,
            body: content,
            attachments: [],
            createdAt: new Date(createdAt),
            creator: resolveRealtimeCreator(senderId),
          }
          appendRealtimeMessage(newMessage)

          if (senderId === userId) {
            patchThreadListFromDetailMessages(threadId, [newMessage], true)
            return
          }

          const active = isThreadActivelyViewed(threadId)
          patchThreadListFromDetailMessages(threadId, [newMessage], active)
          if (active) {
            void markThreadReadAndSync(threadId)
          } else {
            setThreads((prev) =>
              prev.map((t) =>
                t.id === threadId ? { ...t, unreadCount: (t.unreadCount ?? 0) + 1 } : t
              )
            )
            messagingUnread?.applyThreadUnreadDelta(1)
            console.info("[messaging:realtime] background message → increment unread", {
              threadId,
              userId,
            })
          }
        }
      )
      .subscribe()

    realtimeSubscriptionRef.current = subscription
  }

  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel(`messages-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          loadThreads()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadThreads is [teamId]-scoped
  }, [teamId])

  useEffect(() => {
    const onFocus = () => {
      const tid = selectedThreadIdRef.current
      if (tid) {
        void markThreadReadAndSync(tid)
      }
    }

    window.addEventListener("focus", onFocus)

    return () => {
      window.removeEventListener("focus", onFocus)
    }
  }, [markThreadReadAndSync])

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

      if (newMessage && typeof newMessage === "object" && "id" in newMessage) {
        patchThreadListFromDetailMessages(
          selectedThread.id,
          [
            {
              id: String((newMessage as Message).id),
              body: String((newMessage as Message).body ?? ""),
              attachments: (newMessage as Message).attachments ?? [],
              createdAt: new Date((newMessage as Message).createdAt),
              creator: (newMessage as Message).creator,
            },
          ],
          true
        )
      }
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
    if (selectedContacts.length === 0) {
      alert("Please select at least one participant")
      return
    }

    if (threadType === "group") {
      const coachStaff = composeGroupFilter === "coachStaff"
      if (coachStaff && selectedContacts.length > 1 && !newThreadSubject.trim()) {
        alert("Group name is required when messaging multiple people")
        return
      }
      if (!coachStaff && !newThreadSubject.trim()) {
        alert("Group name is required")
        return
      }
    } else if (selectedContacts.length !== 1) {
      alert(`Please select exactly one ${threadType ?? "contact"}`)
      return
    }

    setLoading(true)
    try {
      let subject = newThreadSubject.trim()
      if (
        !subject &&
        threadType === "group" &&
        composeGroupFilter === "coachStaff" &&
        selectedContacts.length === 1
      ) {
        const contact = contacts.find((c) => c.id === selectedContacts[0])
        subject = contact ? `Chat with ${contact.name}` : "New Conversation"
      }
      if (!subject && threadType !== "group" && selectedContacts.length === 1) {
        const contact = contacts.find((c) => c.id === selectedContacts[0])
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

    if (!selectedThread?.id) {
      alert("Select a conversation before attaching a file.")
      e.target.value = ""
      return
    }

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
      formData.append("threadId", selectedThread.id)

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
      e.target.value = ""
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

  const baseFilteredContacts = useMemo(() => {
    if (!threadType) return contacts

    if (threadType === "group" && composeGroupFilter === "coachStaff") {
      return contacts.filter((c) => {
        const typeUpper = (c.type || "").toUpperCase()
        return typeUpper !== "PLAYER" && typeUpper !== "PARENT"
      })
    }

    switch (threadType) {
      case "all":
        return [...contacts].sort((a, b) => {
          const n = a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          return n !== 0 ? n : a.id.localeCompare(b.id)
        })
      case "player":
        return contacts.filter((c) => {
          const typeUpper = c.type?.toUpperCase() || ""
          const roleLower = c.role?.toLowerCase() || ""
          return typeUpper === "PLAYER" || roleLower === "player"
        })
      case "parent":
        return contacts.filter((c) => {
          const typeUpper = c.type?.toUpperCase() || ""
          const roleLower = c.role?.toLowerCase() || ""
          return typeUpper === "PARENT" || roleLower === "parent"
        })
      case "group":
        return contacts
      default:
        return contacts
    }
  }, [contacts, threadType, composeGroupFilter])

  const positionGroupOptions = useMemo(() => {
    const s = new Set<string>()
    for (const c of contacts) {
      const pg = (c.positionGroup || "").trim()
      if (pg) s.add(pg)
    }
    return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  }, [contacts])

  const contactsForParticipantPicker = useMemo(() => {
    const list = baseFilteredContacts
    if (!contactPositionFilter) return list
    return list.filter((c) => {
      const pg = (c.positionGroup || "").trim()
      if (!pg) return false
      return pg.toUpperCase() === contactPositionFilter.toUpperCase()
    })
  }, [baseFilteredContacts, contactPositionFilter])

  useEffect(() => {
    setContactPositionFilter(null)
  }, [threadType, composeGroupFilter])

  const handleCancelCreate = () => {
    setShowCreateThread(false)
    setThreadType(null)
    setComposeGroupFilter(null)
    setContactPositionFilter(null)
    setNewThreadSubject("")
    setSelectedContacts([])
  }

  const openComposeCategory = (type: "all" | "player" | "parent" | "group") => {
    setComposeGroupFilter(null)
    setContactPositionFilter(null)
    setThreadType(type)
    setShowCreateThread(true)
    setSelectedContacts([])
    setNewThreadSubject("")
  }

  /** Coaches + team staff: group thread, same participant list as legacy “Staff” (non-player, non-parent). */
  const openCoachesStaffCompose = () => {
    setComposeGroupFilter("coachStaff")
    setContactPositionFilter(null)
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
                <span
                  className={cn(
                    "ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[rgb(var(--accent))] px-2 py-0.5 text-[11px] font-semibold text-white",
                    "motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out"
                  )}
                >
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

        {canCreateThread && (
          <div className="border-b px-3 py-3 md:px-4 md:py-4" style={{ borderBottomColor: "rgb(var(--border))" }}>
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--muted))] md:text-left">
              Start a conversation
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:gap-3">
              <button
                type="button"
                onClick={() => openComposeCategory("all")}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-white px-2 py-3 text-center shadow-sm transition hover:border-[rgb(var(--accent))]/50 hover:shadow md:min-h-[56px]"
              >
                <LayoutGrid className="h-5 w-5 text-slate-700" aria-hidden />
                <span className="text-xs font-semibold text-[rgb(var(--text))]">All</span>
              </button>
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
                onClick={() => openComposeCategory("parent")}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-white px-2 py-3 text-center shadow-sm transition hover:border-[rgb(var(--accent))]/50 hover:shadow md:min-h-[56px]"
              >
                <Heart className="h-5 w-5 text-violet-600" aria-hidden />
                <span className="text-xs font-semibold text-[rgb(var(--text))]">Parents</span>
              </button>
              <button
                type="button"
                onClick={() => openCoachesStaffCompose()}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-white px-2 py-3 text-center shadow-sm transition hover:border-[rgb(var(--accent))]/50 hover:shadow md:min-h-[56px]"
              >
                <Shield className="h-5 w-5 text-orange-600" aria-hidden />
                <span className="text-xs font-semibold leading-tight text-[rgb(var(--text))]">Coaches &amp; Staff</span>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] leading-snug text-[rgb(var(--muted))] md:text-left">
              All lists everyone you can message. Coaches &amp; Staff opens a group thread — pick one person or several (name required for multiple).
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
              {composeGroupFilter === "coachStaff" && (
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  Choose coaches and team staff. One selection starts a direct-style thread; multiple selections need a group name.
                </p>
              )}
              {threadType === "group" && (composeGroupFilter !== "coachStaff" || selectedContacts.length > 1) && (
                <div>
                  <Label className="text-xs" style={{ color: "rgb(var(--text))" }}>
                    Group name{composeGroupFilter === "coachStaff" && selectedContacts.length > 1 ? " *" : ""}
                  </Label>
                  <Input
                    value={newThreadSubject}
                    onChange={(e) => setNewThreadSubject(e.target.value)}
                    placeholder={
                      composeGroupFilter === "coachStaff" ? "e.g. Staff coordination" : "Enter group name"
                    }
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
                    ? composeGroupFilter === "coachStaff"
                      ? "Select coaches & staff"
                      : "Select members"
                    : threadType === "all"
                      ? "Select contact"
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
                    selectedContacts.length === 0 ||
                    (threadType !== "group" && selectedContacts.length !== 1) ||
                    (threadType === "group" &&
                      composeGroupFilter === "coachStaff" &&
                      selectedContacts.length > 1 &&
                      !newThreadSubject.trim()) ||
                    (threadType === "group" &&
                      composeGroupFilter !== "coachStaff" &&
                      !newThreadSubject.trim())
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

        <div
          className={`messages-thread-list min-h-0 flex-1 overflow-y-auto py-3 md:py-4 ${msgScrollHide}`}
        >
          {initialLoading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-lg animate-pulse bg-muted" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="mx-4 rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--platinum))]/40 px-4 py-10 text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 text-[rgb(var(--accent))]" aria-hidden />
              <p className="text-sm font-medium text-[rgb(var(--text))]">No conversations yet</p>
              <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--muted))]">
                {canCreateThread
                  ? "Use All, Players, Parents, or Coaches & Staff above to start a conversation."
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
                className={`messages-container min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5 ${msgScrollHide}`}
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
                messages.flatMap((message, index) => {
                const prev = index > 0 ? messages[index - 1] : null
                const showDaySep =
                  !prev || messageDayKey(prev.createdAt) !== messageDayKey(message.createdAt)
                const isOwnMessage = message.creator.id === userId
                const removed = message.isRemoved === true
                const bubble = (
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
                        <div className="mt-2 space-y-2">
                          {message.attachments.map((att: any, idx: number) => {
                            const secureUrl = att.id
                              ? `/api/messages/attachments/${att.id}`
                              : `/api/messages/attachments/serve?fileUrl=${encodeURIComponent(att.fileUrl)}`
                            const isImg = messageAttachmentIsImage(att)
                            return (
                              <div key={idx}>
                                {isImg ? (
                                  <a
                                    href={secureUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={secureUrl}
                                      alt={att.fileName || "Image attachment"}
                                      className={cn(
                                        "max-h-64 max-w-full rounded-lg object-contain",
                                        isOwnMessage
                                          ? "border border-white/25"
                                          : "border border-[rgb(var(--border))]"
                                      )}
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={secureUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs underline block"
                                  >
                                    📎 {att.fileName}
                                  </a>
                                )}
                              </div>
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
                if (!showDaySep) return [bubble]
                const sep = (
                  <div
                    key={`day-sep-${message.id}`}
                    className="flex items-center gap-3 py-1"
                    role="separator"
                    aria-label={messageDaySeparatorLabel(message.createdAt)}
                  >
                    <div className="h-px flex-1 bg-[rgb(var(--border))]" />
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-[rgb(var(--muted))]">
                      {messageDaySeparatorLabel(message.createdAt)}
                    </span>
                    <div className="h-px flex-1 bg-[rgb(var(--border))]" />
                  </div>
                )
                return [sep, bubble]
                })
              )}
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
          if (!open) {
            setParticipantsModalPurpose("pick")
            setContactPositionFilter(null)
          }
        }}
      >
        <DialogContent className={`max-h-[85vh] overflow-y-auto bg-white ${msgScrollHide}`}>
          <DialogHeader>
            <DialogTitle>
              {participantsModalPurpose === "view"
                ? "People in this thread"
                : threadType === "group"
                  ? composeGroupFilter === "coachStaff"
                    ? "Select coaches & staff"
                    : "Select group members"
                  : threadType === "all"
                    ? "Select contact"
                    : `Select ${threadType ? threadType.charAt(0).toUpperCase() + threadType.slice(1) : "someone"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {participantsModalPurpose === "pick" &&
              positionGroupOptions.length > 0 &&
              (threadType === "player" || threadType === "all" || (threadType === "group" && composeGroupFilter === "coachStaff")) && (
                <div className="space-y-1">
                  <Label className="text-xs" style={{ color: "rgb(var(--text))" }}>
                    Position group
                  </Label>
                  <select
                    value={contactPositionFilter ?? ""}
                    onChange={(e) => setContactPositionFilter(e.target.value || null)}
                    className="mt-0.5 flex h-9 w-full rounded-xl border border-[rgb(var(--border))] bg-white px-3 text-sm text-[rgb(var(--text))]"
                  >
                    <option value="">All positions</option>
                    {positionGroupOptions.map((pg) => (
                      <option key={pg} value={pg}>
                        {pg}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            {participantsModalPurpose === "view" && selectedThread ? (
              <div className={`messages-thread-list max-h-96 space-y-2 overflow-y-auto ${msgScrollHide}`}>
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
              <div className={`messages-thread-list max-h-96 space-y-2 overflow-y-auto ${msgScrollHide}`}>
                {contactsForParticipantPicker.length === 0 ? (
                  <p className="py-4 text-center text-sm" style={{ color: "rgb(var(--muted))" }}>
                    {contactPositionFilter
                      ? "No contacts match this position filter."
                      : threadType
                        ? "No contacts available."
                        : "No contacts available"}
                  </p>
                ) : (
                  contactsForParticipantPicker.map((contact) => (
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
                            {contact.positionGroup ? ` · ${contact.positionGroup}` : ""}
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
