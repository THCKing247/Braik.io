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
import { useQueryClient } from "@tanstack/react-query"
import type { AppBootstrapPayload } from "@/lib/app/app-bootstrap-types"
import type { FullDashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import {
  dashboardBootstrapQueryKey,
  useDashboardBootstrapQuery,
} from "@/lib/dashboard/dashboard-bootstrap-query"

type Phase = "idle" | "loading" | "ok" | "error"

export type AppBootstrapCoreContextValue = {
  teamId: string
  phase: Phase
  payload: AppBootstrapPayload | null
  refetch: () => Promise<void>
}

export type AppBootstrapUnreadContextValue = {
  /** Server unread + client optimistic delta (for badges / shell). */
  effectiveUnreadNotifications: number
  /** Negative values reduce displayed unread until next refetch. */
  applyUnreadDelta: (delta: number) => void
  /**
   * Align shell unread with GET /api/notifications `unreadCount` (same source as bootstrap).
   * Clears pending optimistic delta.
   */
  syncUnreadFromServerCount: (count: number) => void
}

export type AppBootstrapContextValue = AppBootstrapCoreContextValue & AppBootstrapUnreadContextValue

const AppBootstrapCoreContext = createContext<AppBootstrapCoreContextValue | null>(null)
const AppBootstrapUnreadContext = createContext<AppBootstrapUnreadContextValue | null>(null)

export function useAppBootstrap(): AppBootstrapContextValue {
  const core = useContext(AppBootstrapCoreContext)
  const unread = useContext(AppBootstrapUnreadContext)
  if (!core || !unread) {
    throw new Error("useAppBootstrap must be used within AppBootstrapProvider")
  }
  return { ...core, ...unread }
}

/** Subscribes to core bootstrap only (payload, phase, refetch). Unread changes will not rerender. */
export function useAppBootstrapCoreOptional(): AppBootstrapCoreContextValue | null {
  return useContext(AppBootstrapCoreContext)
}

/** Subscribes to unread badge state only. Payload / phase updates will not rerender. */
export function useAppBootstrapUnreadOptional(): AppBootstrapUnreadContextValue | null {
  return useContext(AppBootstrapUnreadContext)
}

/**
 * @deprecated Prefer `useAppBootstrapCoreOptional` / `useAppBootstrapUnreadOptional` to avoid
 * rerendering on unrelated bootstrap fields. Subscribes to both layers.
 */
export function useAppBootstrapOptional(): AppBootstrapContextValue | null {
  const core = useContext(AppBootstrapCoreContext)
  const unread = useContext(AppBootstrapUnreadContext)
  if (!core || !unread) return null
  return { ...core, ...unread }
}

export function AppBootstrapProvider({
  teamId,
  children,
}: {
  teamId: string
  children: ReactNode
}) {
  const tid = teamId.trim()
  const q = useDashboardBootstrapQuery(teamId)
  const queryClient = useQueryClient()
  const [pendingUnreadDelta, setPendingUnreadDelta] = useState(0)

  useEffect(() => {
    setPendingUnreadDelta(0)
  }, [tid])

  const payload = tid && q.data?.shell ? q.data.shell : null

  const phase: Phase = !tid
    ? "idle"
    : q.isPending && !q.data
      ? "loading"
      : q.data?.shell
        ? "ok"
        : q.isError
          ? "error"
          : q.isPending
            ? "loading"
            : "error"

  const refetch = useCallback(async () => {
    await q.refetch()
  }, [q])

  const applyUnreadDelta = useCallback((delta: number) => {
    setPendingUnreadDelta((x) => x + delta)
  }, [])

  const syncUnreadFromServerCount = useCallback(
    (count: number) => {
      const next = Math.max(0, count)
      setPendingUnreadDelta(0)
      if (!tid) return
      queryClient.setQueryData(
        dashboardBootstrapQueryKey(tid),
        (prev: FullDashboardBootstrapPayload | undefined) => {
          if (!prev?.shell) return prev
          if (prev.shell.unreadNotifications === next) return prev
          return {
            ...prev,
            shell: { ...prev.shell, unreadNotifications: next },
            notifications: {
              ...prev.notifications,
              unreadCount: next,
            },
          }
        }
      )
    },
    [queryClient, tid]
  )

  const effectiveUnreadNotifications = Math.max(
    0,
    (payload?.unreadNotifications ?? 0) + pendingUnreadDelta
  )

  const coreValue = useMemo<AppBootstrapCoreContextValue>(
    () => ({
      teamId,
      phase,
      payload,
      refetch,
    }),
    [teamId, phase, payload, refetch]
  )

  const unreadValue = useMemo<AppBootstrapUnreadContextValue>(
    () => ({
      effectiveUnreadNotifications,
      applyUnreadDelta,
      syncUnreadFromServerCount,
    }),
    [effectiveUnreadNotifications, applyUnreadDelta, syncUnreadFromServerCount]
  )

  return (
    <AppBootstrapCoreContext.Provider value={coreValue}>
      <AppBootstrapUnreadContext.Provider value={unreadValue}>{children}</AppBootstrapUnreadContext.Provider>
    </AppBootstrapCoreContext.Provider>
  )
}
