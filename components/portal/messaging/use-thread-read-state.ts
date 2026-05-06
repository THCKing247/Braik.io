"use client"

import { useCallback } from "react"
import type { Thread } from "@/components/portal/messaging/types"

export function useThreadReadState({
  setThreads,
  setSelectedThread,
}: {
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>
  setSelectedThread: React.Dispatch<React.SetStateAction<Thread | null>>
}) {
  const markThreadAsReadOptimistic = useCallback(
    (threadId: string) => {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t)))
      setSelectedThread((prev) => (prev && prev.id === threadId ? { ...prev, unreadCount: 0 } : prev))
    },
    [setSelectedThread, setThreads]
  )

  const postMarkThreadRead = useCallback(async (threadId: string) => {
    await fetch(`/api/messages/threads/${threadId}/read`, { method: "POST" })
  }, [])

  const markThreadRead = useCallback(
    async (threadId: string) => {
      markThreadAsReadOptimistic(threadId)
      try {
        await postMarkThreadRead(threadId)
      } catch {
        // Keep optimistic value; next load will reconcile.
      }
    },
    [markThreadAsReadOptimistic, postMarkThreadRead]
  )

  return { markThreadRead }
}
