"use client"

import { useCallback, useEffect, useRef } from "react"
import { supabaseClient } from "@/src/lib/supabaseClient"
import type { Message } from "@/components/portal/messaging/types"

export function useMessageRealtime({
  activeThreadId,
  setMessages,
  optimisticMessageIdRef,
  setIngressRealtime,
  setScrollIntentToBottomIfNearBottom,
}: {
  activeThreadId?: string
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  optimisticMessageIdRef: React.MutableRefObject<string | null>
  setIngressRealtime: () => void
  setScrollIntentToBottomIfNearBottom: () => void
}) {
  const realtimeSubscriptionRef = useRef<any>(null)
  const activeThreadIdRef = useRef<string | undefined>(activeThreadId)

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId
  }, [activeThreadId])

  const cleanup = useCallback(() => {
    if (realtimeSubscriptionRef.current) {
      realtimeSubscriptionRef.current.unsubscribe()
      realtimeSubscriptionRef.current = null
    }
  }, [])

  const appendRealtimeMessage = useCallback(
    (newMessageId: string, newMessage: Message) => {
      setIngressRealtime()
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        if (existingIds.has(newMessageId)) return prev
        return [...prev, newMessage].sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime()
          const bTime = new Date(b.createdAt).getTime()
          return aTime - bTime
        })
      })
    },
    [setIngressRealtime, setMessages]
  )

  useEffect(() => {
    cleanup()
    if (!activeThreadId) return

    const threadId = activeThreadId
    const subscription = supabaseClient
      .channel(`messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          if (activeThreadIdRef.current !== threadId) return
          const newMessageId = payload.new.id as string
          if (optimisticMessageIdRef.current === newMessageId) {
            optimisticMessageIdRef.current = null
            return
          }

          const senderId = payload.new.sender_id as string
          const content = payload.new.content as string
          const createdAt = payload.new.created_at as string
          setScrollIntentToBottomIfNearBottom()

          try {
            const senderResponse = await fetch(`/api/messages/sender/${senderId}`)
            const senderData = senderResponse.ok ? await senderResponse.json() : null
            appendRealtimeMessage(newMessageId, {
              id: newMessageId,
              body: content,
              attachments: [],
              createdAt: new Date(createdAt),
              creator: senderData || { id: senderId, name: null, email: "" },
            })
          } catch {
            appendRealtimeMessage(newMessageId, {
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
    return cleanup
  }, [activeThreadId, appendRealtimeMessage, cleanup, optimisticMessageIdRef, setScrollIntentToBottomIfNearBottom])
}
