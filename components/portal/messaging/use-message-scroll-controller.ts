"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { isNearBottomEl } from "@/components/portal/messaging/messaging-display-utils"

export type MessageIngress = "idle" | "full-load" | "poll" | "realtime" | "user-send" | "optimistic"

export function useMessageScrollController(messageCount: number, activeThreadId?: string) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showJumpToNewest, setShowJumpToNewest] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const isUserScrollingRef = useRef<boolean>(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageIngressRef = useRef<MessageIngress>("idle")
  const scrollIntentAfterNextMessagesRef = useRef<"bottom" | "keep">("keep")
  const lastMessageCountRef = useRef<number>(0)

  useLayoutEffect(() => {
    const ingress = messageIngressRef.current
    messageIngressRef.current = "idle"
    const container = messagesContainerRef.current
    const curr = messageCount
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
  }, [messageCount])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (isNearBottomEl(container)) {
        setShowJumpToNewest(false)
        setUnreadCount(0)
      }
      isUserScrollingRef.current = true
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false
      }, 150)
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      container.removeEventListener("scroll", handleScroll)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [activeThreadId])

  const setIngress = useCallback((ingress: MessageIngress) => {
    messageIngressRef.current = ingress
  }, [])

  const setScrollIntentToBottomIfNearBottom = useCallback(() => {
    const c = messagesContainerRef.current
    scrollIntentAfterNextMessagesRef.current = c && isNearBottomEl(c) ? "bottom" : "keep"
  }, [])

  const forceScrollIntentBottom = useCallback(() => {
    scrollIntentAfterNextMessagesRef.current = "bottom"
  }, [])

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
      } catch {
        messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" })
      }
    }
    setShowJumpToNewest(false)
    setUnreadCount(0)
  }, [])

  const resetOnThreadOpen = useCallback(() => {
    lastMessageCountRef.current = 0
  }, [])

  return {
    messagesContainerRef,
    messagesEndRef,
    showJumpToNewest,
    unreadCount,
    setIngress,
    setScrollIntentToBottomIfNearBottom,
    forceScrollIntentBottom,
    scrollToBottom,
    resetOnThreadOpen,
  }
}
