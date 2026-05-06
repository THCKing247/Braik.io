"use client"

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  type MouseEvent,
} from "react"
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
import type { Contact, Message, ParticipantKind, Thread } from "@/components/portal/messaging/types"
import {
  displayNameForParticipantUser,
  getThreadDisplayName,
  initialsFromDisplayName,
  isNearBottomEl,
  threadCategoryLabel,
} from "@/components/portal/messaging/messaging-display-utils"
import { avatarClassForKind } from "@/components/portal/messaging/messaging-row-utils"
import { ThreadInboxList } from "@/components/portal/messaging/ThreadInboxList"
import { MessageViewport } from "@/components/portal/messaging/MessageViewport"
import { MessageComposer } from "@/components/portal/messaging/MessageComposer"
import { useMessageScrollController } from "@/components/portal/messaging/use-message-scroll-controller"
import { useMessageRealtime } from "@/components/portal/messaging/use-message-realtime"
import { useThreadReadState } from "@/components/portal/messaging/use-thread-read-state"
import { useOptimisticMessageSend } from "@/components/portal/messaging/use-optimistic-message-send"
import { navPerfDev } from "@/lib/debug/nav-perf-dev"

function starredStorageKey(uid: string, tid: string) {
  return `braik-msg-starred:${uid}:${tid}`
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
  const optimisticMessageIdRef = useRef<string | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef<boolean>(false)
  const [refreshing, setRefreshing] = useState(false)
  const urlThreadIdProcessedRef = useRef<boolean>(false)
  const [starredThreadIds, setStarredThreadIds] = useState<Set<string>>(new Set())
  const [isWide, setIsWide] = useState(false)
  const [mobileShowList, setMobileShowList] = useState(true)
  const [composeGroupFilter, setComposeGroupFilter] = useState<null | "staff">(null)
  const [participantsModalPurpose, setParticipantsModalPurpose] = useState<"pick" | "view">("pick")
  const [priorityCollapsed, setPriorityCollapsed] = useState(false)
  const {
    messagesContainerRef,
    messagesEndRef,
    showJumpToNewest,
    unreadCount,
    setIngress,
    setScrollIntentToBottomIfNearBottom,
    forceScrollIntentBottom,
    scrollToBottom,
    resetOnThreadOpen,
  } = useMessageScrollController(messages.length, selectedThread?.id)

  const permissions = getMessagingPermissions(userRole as any)
  const canCreateThread = permissions.canCreateThread()
  const [announcementPreview, setAnnouncementPreview] = useState<TeamAnnouncementRow[]>([])
  const { markThreadRead } = useThreadReadState({ setThreads, setSelectedThread })

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
      resetOnThreadOpen()
      navPerfDev("messages.thread_open.start", { threadId })
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
    }
    // Cleanup: clear interval
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id]) // Only depend on threadId, not the whole object
  
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
        setIngress("full-load")
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
        void markThreadRead(threadId)
        navPerfDev("messages.thread_open.fetch_complete", { threadId, count: sortedMessages.length })
        requestAnimationFrame(() => {
          navPerfDev("messages.thread_open.render_complete", { threadId })
        })
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
    setScrollIntentToBottomIfNearBottom()
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

          setIngress("poll")

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

  useMessageRealtime({
    activeThreadId: selectedThread?.id,
    setMessages,
    optimisticMessageIdRef,
    setIngressRealtime: () => setIngress("realtime"),
    setScrollIntentToBottomIfNearBottom,
  })

  const { sendMessage: handleSendMessage } = useOptimisticMessageSend({
    selectedThread,
    userId,
    contacts,
    attachments,
    messageBody,
    setMessages,
    setMessageBody,
    setAttachments,
    setError,
    setLoading,
    optimisticMessageIdRef,
    setIngressOptimistic: () => setIngress("optimistic"),
    setIngressUserSend: () => setIngress("user-send"),
    forceScrollIntentBottom,
    onAfterSuccessfulSend: () => {
      void loadThreads()
    },
  })

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

  const handleSelectThread = useCallback((thread: Thread) => {
    setSelectedThread(thread)
    setMobileShowList(false)
  }, [])

  const handleToggleThreadStar = useCallback((threadId: string, e: MouseEvent) => {
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
  }, [userId, teamId])

  const sortedThreadSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = q
      ? threads.filter((thread) => {
          const displayName = getThreadDisplayName(thread, userId).toLowerCase()
          const lastMessage = thread.messages[0]?.body?.toLowerCase() || ""
          return displayName.includes(q) || lastMessage.includes(q)
        })
      : threads

    const byUpdated = (a: Thread, b: Thread) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

    const starred = base.filter((t) => starredThreadIds.has(t.id)).sort(byUpdated)
    const rest = base.filter((t) => !starredThreadIds.has(t.id)).sort(byUpdated)
    return { starred, rest }
  }, [threads, searchQuery, starredThreadIds, userId])

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
            <ThreadInboxList
              starred={sortedThreadSections.starred}
              rest={sortedThreadSections.rest}
              priorityCollapsed={priorityCollapsed}
              onTogglePriorityCollapsed={() => setPriorityCollapsed((c) => !c)}
              selectedThreadId={selectedThread?.id}
              userId={userId}
              starredThreadIds={starredThreadIds}
              onSelectThread={handleSelectThread}
              onToggleStar={handleToggleThreadStar}
            />
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
                    {getThreadDisplayName(selectedThread, userId)}
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
                      {threadCategoryLabel(selectedThread, userId)}
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

            <MessageViewport
              messages={messages}
              messagesLoading={messagesLoading}
              userId={userId}
              canModerate={selectedThread?.canModerate === true}
              onModerateMessage={handleModerateMessage}
              containerRef={messagesContainerRef}
              endRef={messagesEndRef}
              showJumpToNewest={showJumpToNewest}
              unreadCount={unreadCount}
              onJumpToNewest={handleJumpToNewest}
            />

            {/* Message Input */}
            <MessageComposer
              disabled={selectedThread.isReadOnly}
              loading={loading}
              messageBody={messageBody}
              attachments={attachments}
              onMessageBodyChange={setMessageBody}
              onFileUpload={handleFileUpload}
              onRemoveAttachment={removeAttachment}
              onSend={handleSendMessage}
            />
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
