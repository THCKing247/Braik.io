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
    setPhase("loading")
    try {
      const res = await fetch(`/api/app/bootstrap?teamId=${encodeURIComponent(teamId)}`, {
        credentials: "same-origin",
      })
      if (!res.ok) {
        setPhase("error")
        setPayload(null)
        return
      }
      const data = (await res.json()) as AppBootstrapPayload
      setPayload(data)
      setPendingUnreadDelta(0)
      setPhase("ok")
    } catch {
      setPhase("error")
      setPayload(null)
    }
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  const applyUnreadDelta = useCallback((delta: number) => {
    setPendingUnreadDelta((x) => x + delta)
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
    }),
    [teamId, phase, payload, effectiveUnreadNotifications, load, applyUnreadDelta]
  )

  return <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>
}
