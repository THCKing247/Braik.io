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

export type AppBootstrapContextValue = {
  teamId: string
  phase: Phase
  payload: AppBootstrapPayload | null
  /** True while bootstrap-light has merged but deferred-core snapshot is not in the React Query cache yet. */
  deferredCorePending: boolean
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

  const deferredCorePending = Boolean(tid && q.data?.deferredPending === true)

  const value = useMemo<AppBootstrapContextValue>(
    () => ({
      teamId,
      phase,
      payload,
      deferredCorePending,
      effectiveUnreadNotifications,
      refetch,
      applyUnreadDelta,
      syncUnreadFromServerCount,
    }),
    [
      teamId,
      phase,
      payload,
      deferredCorePending,
      effectiveUnreadNotifications,
      refetch,
      applyUnreadDelta,
      syncUnreadFromServerCount,
    ]
  )

  return <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>
}
