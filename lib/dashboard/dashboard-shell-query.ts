"use client"

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { DashboardShellPayload } from "@/lib/dashboard/dashboard-shell-payload"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { navPerfDev } from "@/lib/debug/nav-perf-dev"

export class DashboardShellUnauthorizedError extends Error {
  override name = "DashboardShellUnauthorizedError"
}

/**
 * One shell fetch per browser session unless invalidated (e.g. after onboarding).
 * Avoids re-running auth + team list on every client-side pathname change.
 */
export const BRAIK_DASHBOARD_SHELL_QUERY_KEY = ["braik-dashboard-shell"] as const

const SHELL_STALE_MS = 2 * 60 * 1000

async function fetchDashboardShell(): Promise<DashboardShellPayload> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0
  authTimingClient("dashboard_shell_query_fetch_start")
  navPerfDev("dashboard_shell_fetch_start")

  const res = await fetch("/api/dashboard/shell", {
    credentials: "include",
  })

  const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0
  authTimingClient("dashboard_shell_query_fetch_done", { ms, status: res.status })
  navPerfDev("dashboard_shell_fetch_done", { ms, status: res.status })

  if (res.status === 401) {
    throw new DashboardShellUnauthorizedError("Unauthorized")
  }
  if (!res.ok) {
    throw new Error(`shell ${res.status}`)
  }
  return (await res.json()) as DashboardShellPayload
}

export function useDashboardShellQuery() {
  return useQuery({
    queryKey: BRAIK_DASHBOARD_SHELL_QUERY_KEY,
    queryFn: fetchDashboardShell,
    staleTime: SHELL_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
}

export function invalidateDashboardShell(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: BRAIK_DASHBOARD_SHELL_QUERY_KEY }).then(() => undefined)
}

export function isDashboardShellUnauthorizedError(e: unknown): boolean {
  return e instanceof DashboardShellUnauthorizedError
}
