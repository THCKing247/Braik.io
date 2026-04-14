"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

/**
 * Optimistic + server-aligned **thread** unread total for the current team (sum across threads).
 * Composed with notification unread in nav for the Messages icon badge.
 */
type MessagingUnreadContextValue = {
  /** Server total from last `/api/messages/threads` meta + client delta (optimistic). */
  effectiveThreadUnread: number
  syncThreadUnreadFromServer: (count: number) => void
  applyThreadUnreadDelta: (delta: number) => void
}

const MessagingUnreadContext = createContext<MessagingUnreadContextValue | null>(null)

export function MessagingUnreadProvider({ children }: { children: ReactNode }) {
  const [serverThreadUnread, setServerThreadUnread] = useState<number | null>(null)
  const [pendingDelta, setPendingDelta] = useState(0)

  const syncThreadUnreadFromServer = useCallback((count: number) => {
    setServerThreadUnread(Math.max(0, count))
    setPendingDelta(0)
  }, [])

  const applyThreadUnreadDelta = useCallback((delta: number) => {
    setPendingDelta((x) => x + delta)
  }, [])

  const effectiveThreadUnread = Math.max(0, (serverThreadUnread ?? 0) + pendingDelta)

  const value = useMemo<MessagingUnreadContextValue>(
    () => ({
      effectiveThreadUnread,
      syncThreadUnreadFromServer,
      applyThreadUnreadDelta,
    }),
    [effectiveThreadUnread, syncThreadUnreadFromServer, applyThreadUnreadDelta]
  )

  return <MessagingUnreadContext.Provider value={value}>{children}</MessagingUnreadContext.Provider>
}

export function useMessagingUnreadOptional(): MessagingUnreadContextValue | null {
  return useContext(MessagingUnreadContext)
}
