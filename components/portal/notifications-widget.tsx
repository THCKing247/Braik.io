"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildNotificationRoute, buildNotificationUrl } from "@/lib/utils/notification-router"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import {
  useNotificationPollIntervalMs,
  useNotificationsPollingActive,
  useOnDocumentForeground,
} from "@/lib/hooks/use-notifications-polling"
import { readLightweightMemoryRaw, writeLightweightMemory } from "@/lib/api-client/lightweight-fetch-memory"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import { ScrollFadeContainer } from "@/components/ui/scroll-fade-container"

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  linkType: string | null
  linkId: string | null
  read: boolean
  createdAt: string
}

interface NotificationsWidgetProps {
  teamId: string
}

const notifMemKey = (teamId: string) => `lw-mem:notifications-preview:${teamId.trim()}`

export function NotificationsWidget({ teamId }: NotificationsWidgetProps) {
  const router = useRouter()
  const shell = useAppBootstrapOptional()
  const shellRef = useRef(shell)
  shellRef.current = shell

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [staleHint, setStaleHint] = useState<string | null>(null)
  const pollingAllowed = useNotificationsPollingActive()
  const pollMs = useNotificationPollIntervalMs()

  const fetchInFlight = useRef(false)

  const loadNotifications = useCallback(async () => {
    if (!teamId.trim() || fetchInFlight.current) return
    fetchInFlight.current = true
    try {
      const response = await fetchWithTimeout(
        `/api/notifications?teamId=${encodeURIComponent(teamId)}&limit=10&preview=1`,
        { credentials: "same-origin" }
      )
      if (response.ok) {
        const data = await response.json()
        const list = (data.notifications || []) as Notification[]
        const uc = typeof data.unreadCount === "number" ? data.unreadCount : 0
        setNotifications(list)
        setUnreadCount(uc)
        shellRef.current?.syncUnreadFromServerCount(uc)
        writeLightweightMemory(notifMemKey(teamId), { notifications: list, unreadCount: uc })
        setStaleHint(null)
      } else if (readLightweightMemoryRaw(notifMemKey(teamId))) {
        setStaleHint("Showing last notifications — refresh failed")
      }
    } catch {
      const mem = readLightweightMemoryRaw(notifMemKey(teamId))
      if (mem) {
        const v = mem.value as { notifications: Notification[]; unreadCount: number }
        setNotifications(v.notifications)
        setUnreadCount(v.unreadCount)
        setStaleHint("Showing last notifications — still syncing…")
      }
    } finally {
      fetchInFlight.current = false
    }
  }, [teamId])

  const loadRef = useRef(loadNotifications)
  loadRef.current = loadNotifications

  useEffect(() => {
    const mem = readLightweightMemoryRaw(notifMemKey(teamId))
    if (mem && mem.ageMs < 25_000) {
      const v = mem.value as { notifications: Notification[]; unreadCount: number }
      setNotifications(v.notifications)
      setUnreadCount(v.unreadCount)
    }
    void loadRef.current()
  }, [teamId])

  useEffect(() => {
    if (!pollingAllowed) return
    const interval = setInterval(() => void loadRef.current(), pollMs)
    return () => clearInterval(interval)
  }, [pollingAllowed, pollMs])

  useOnDocumentForeground(() => void loadRef.current(), Boolean(teamId))

  const markAsRead = async (notificationId: string) => {
    shell?.applyUnreadDelta(-1)
    setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
      })
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        )
        void loadNotifications()
      } else {
        shell?.applyUnreadDelta(1)
        setUnreadCount((prev) => prev + 1)
      }
    } catch (error) {
      shell?.applyUnreadDelta(1)
      setUnreadCount((prev) => prev + 1)
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    const prev = notifications
    const unreadBefore = prev.filter((n) => !n.read).length
    if (unreadBefore === 0) return
    setLoading(true)
    shell?.applyUnreadDelta(-unreadBefore)
    setUnreadCount(0)
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      })
      if (response.ok) {
        setNotifications((p) => p.map((n) => ({ ...n, read: true })))
        void loadNotifications()
      } else {
        shell?.applyUnreadDelta(unreadBefore)
        setUnreadCount(unreadBefore)
        setNotifications(prev)
      }
    } catch (error) {
      shell?.applyUnreadDelta(unreadBefore)
      setUnreadCount(unreadBefore)
      setNotifications(prev)
      console.error("Error marking all as read:", error)
    } finally {
      setLoading(false)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        // Update unread count if deleted notification was unread
        const deleted = notifications.find(n => n.id === notificationId)
        if (deleted && !deleted.read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error("Error deleting notification:", error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    
    // Build route using centralized routing utility
    const route = buildNotificationRoute(
      notification.linkType,
      notification.linkId,
      notification.linkUrl,
      teamId
    )
    
    if (route) {
      // Close notification dropdown
      setIsOpen(false)
      
      // Navigate using Next.js router for better UX
      const url = buildNotificationUrl(route)
      
      // If it's an absolute URL, use window.location
      if (url.startsWith("http://") || url.startsWith("https://")) {
        window.location.href = url
      } else {
        // Use Next.js router for internal navigation
        router.push(url)
      }
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Notifications
                </h3>
                {staleHint ? (
                  <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">{staleHint}</p>
                ) : null}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Mark all read
                </button>
              )}
            </div>

            <ScrollFadeContainer
              variant="panel"
              fadeHeight="h-6"
              className="max-h-96 min-h-0"
              scrollClassName="overflow-y-auto"
            >
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No notifications
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`border-b border-gray-100 p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 ${
                      !notification.read ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p
                              className={`text-sm font-medium ${
                                !notification.read
                                  ? "text-gray-900 dark:text-gray-100"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              {notification.title}
                            </p>
                            {notification.body && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {notification.body}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                              {formatTime(notification.createdAt)}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            aria-label="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Delete"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollFadeContainer>
          </div>
        </>
      )}
    </div>
  )
}
