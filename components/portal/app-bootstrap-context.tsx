"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { AppBootstrapPayload } from "@/lib/app/app-bootstrap-types"
import { readLightweightMemoryRaw, writeLightweightMemory } from "@/lib/api-client/lightweight-fetch-memory"

type Phase = "idle" | "loading" | "ok" | "error"

export type AppBootstrapContextValue = {
  teamId: string
  phase: Phase
  payload: AppBootstrapPayload | null
  /** Server unread + client optimistic delta (for badges / shell). */
  effectiveUnreadNotifications: number
  refetch: () => Promise<void>
  /** Negative values reduce displayed unread until next refetch. */
  applyUnreadDelta: (delta: number) => void
  /**
   * Align shell unread with GET /api/notifications `unreadCount` (same source as bootstrap).
   * Clears pending optimistic delta.
   */
  syncUnreadFromServerCount: (count: number) => void
}

const AppBootstrapContext = createContext<AppBootstrapContextValue | null>(null)

export function useAppBootstrap(): AppBootstrapContextValue {
  const ctx = useContext(AppBootstrapContext)
  if (!ctx) {
    throw new Error("useAppBootstrap must be used within AppBootstrapProvider")
  }
  return ctx
}

/** Safe for components that may render outside the team shell. */
export function useAppBootstrapOptional(): AppBootstrapContextValue | null {
  return useContext(AppBootstrapContext)
}

export function AppBootstrapProvider({
  teamId,
  children,
}: {
  teamId: string
  children: ReactNode
}) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [payload, setPayload] = useState<AppBootstrapPayload | null>(null)
  const [pendingUnreadDelta, setPendingUnreadDelta] = useState(0)

  const load = useCallback(async () => {
    if (!teamId) {
      setPhase("idle")
      setPayload(null)
      return
    }
    const memK = `lw-mem:app-bootstrap:${teamId}`
    const mem = readLightweightMemoryRaw(memK)
    if (mem) {
      setPayload(mem.value as AppBootstrapPayload)
      setPendingUnreadDelta(0)
      setPhase("ok")
    } else {
      setPhase("loading")
    }
    try {
      const res = await fetch(`/api/app/bootstrap?teamId=${encodeURIComponent(teamId)}`, {
        credentials: "same-origin",
      })
      if (!res.ok) {
        if (!mem) {
          setPhase("error")
          setPayload(null)
        }
        return
      }
      const data = (await res.json()) as AppBootstrapPayload
      writeLightweightMemory(memK, data)
      setPayload(data)
      setPendingUnreadDelta(0)
      setPhase("ok")
    } catch {
      if (!mem) {
        setPhase("error")
        setPayload(null)
      }
    }
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  const applyUnreadDelta = useCallback((delta: number) => {
    setPendingUnreadDelta((x) => x + delta)
  }, [])

  const syncUnreadFromServerCount = useCallback((count: number) => {
    const next = Math.max(0, count)
    setPendingUnreadDelta(0)
    setPayload((p) => {
      if (!p) return p
      if (p.unreadNotifications === next) return p
      return { ...p, unreadNotifications: next }
    })
  }, [])

  const effectiveUnreadNotifications = Math.max(
    0,
    (payload?.unreadNotifications ?? 0) + pendingUnreadDelta
  )

  const value = useMemo<AppBootstrapContextValue>(
    () => ({
      teamId,
      phase,
      payload,
      effectiveUnreadNotifications,
      refetch: load,
      applyUnreadDelta,
      syncUnreadFromServerCount,
    }),
    [teamId, phase, payload, effectiveUnreadNotifications, load, applyUnreadDelta, syncUnreadFromServerCount]
  )

  return <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>
}
