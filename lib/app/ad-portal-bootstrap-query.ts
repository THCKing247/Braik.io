"use client"

import { usePathname } from "next/navigation"
import { useQuery, type QueryClient } from "@tanstack/react-query"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { navPerfDev } from "@/lib/debug/nav-perf-dev"
import { adTeamsFlowPerfClient } from "@/lib/ad/ad-teams-table-perf-client"

export class AdPortalBootstrapUnauthorizedError extends Error {
  override name = "AdPortalBootstrapUnauthorizedError"
}

export class AdPortalBootstrapForbiddenError extends Error {
  override name = "AdPortalBootstrapForbiddenError"
}

/** Root segment for React Query; pair with `includeTeamsTable` boolean. */
export const AD_PORTAL_BOOTSTRAP_QUERY_ROOT = "braik-ad-portal-bootstrap" as const

export function adPortalBootstrapQueryKey(includeTeamsTable: boolean) {
  return [AD_PORTAL_BOOTSTRAP_QUERY_ROOT, includeTeamsTable] as const
}

export function adPortalBootstrapIncludeTeamsTable(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.includes("/dashboard/ad/teams"))
}

export const AD_PORTAL_BOOTSTRAP_STALE_MS = 2 * 60 * 1000

export async function fetchAdPortalBootstrap(includeTeamsTable: boolean): Promise<AppAdPortalBootstrapPayload> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0
  authTimingClient("ad_portal_bootstrap_query_fetch_start", { includeTeamsTable })
  navPerfDev("ad_portal_bootstrap_fetch_start", { includeTeamsTable })

  const q = includeTeamsTable ? "1" : "0"
  const res = await fetch(`/api/app/bootstrap?portal=ad&includeTeamsTable=${q}`, {
    credentials: "same-origin",
  })

  const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0
  authTimingClient("ad_portal_bootstrap_query_fetch_done", { ms, status: res.status, includeTeamsTable })
  navPerfDev("ad_portal_bootstrap_fetch_done", { ms, status: res.status, includeTeamsTable })

  if (res.status === 401) {
    throw new AdPortalBootstrapUnauthorizedError("Unauthorized")
  }
  if (res.status === 403) {
    throw new AdPortalBootstrapForbiddenError("Forbidden")
  }
  if (!res.ok) {
    throw new Error(`ad bootstrap ${res.status}`)
  }
  const payload = (await res.json()) as AppAdPortalBootstrapPayload
  adTeamsFlowPerfClient("ad_portal_bootstrap_fetch_total_ms", {
    ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
    teamsSummaryCount: Array.isArray(payload.teamsSummary) ? payload.teamsSummary.length : 0,
    teamsTableCount: Array.isArray(payload.teamsTable) ? payload.teamsTable.length : 0,
    includeTeamsTable,
  })
  return payload
}

export function useAdPortalBootstrapQuery() {
  const pathname = usePathname()
  const includeTeamsTable = adPortalBootstrapIncludeTeamsTable(pathname)

  return useQuery({
    queryKey: adPortalBootstrapQueryKey(includeTeamsTable),
    queryFn: () => fetchAdPortalBootstrap(includeTeamsTable),
    staleTime: AD_PORTAL_BOOTSTRAP_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
}

/** Clears all AD bootstrap variants (shell-only and with-teams). */
export function invalidateAdPortalBootstrap(queryClient: QueryClient): Promise<void> {
  return queryClient
    .invalidateQueries({ queryKey: [AD_PORTAL_BOOTSTRAP_QUERY_ROOT] })
    .then(() => undefined)
}

export function isAdPortalBootstrapUnauthorizedError(e: unknown): boolean {
  return e instanceof AdPortalBootstrapUnauthorizedError
}

export function isAdPortalBootstrapForbiddenError(e: unknown): boolean {
  return e instanceof AdPortalBootstrapForbiddenError
}
