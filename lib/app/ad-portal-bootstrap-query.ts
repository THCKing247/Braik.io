"use client"

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

/** Single React Query key for AD portal shell (no embedded teams table — teams load on `/dashboard/ad/teams` via SSR + `/api/ad/pages/teams-table`). */
export const AD_PORTAL_BOOTSTRAP_QUERY_ROOT = "braik-ad-portal-bootstrap" as const

export const AD_PORTAL_BOOTSTRAP_QUERY_KEY = [AD_PORTAL_BOOTSTRAP_QUERY_ROOT] as const

export const AD_PORTAL_BOOTSTRAP_STALE_MS = 2 * 60 * 1000

export async function fetchAdPortalBootstrap(): Promise<AppAdPortalBootstrapPayload> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0
  authTimingClient("ad_portal_bootstrap_query_fetch_start", {})
  navPerfDev("ad_portal_bootstrap_fetch_start", {})

  const res = await fetch(`/api/app/bootstrap?portal=ad&includeTeamsTable=0`, {
    credentials: "same-origin",
  })

  const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0
  authTimingClient("ad_portal_bootstrap_query_fetch_done", { ms, status: res.status })
  navPerfDev("ad_portal_bootstrap_fetch_done", { ms, status: res.status })

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
  })
  return payload
}

export type UseAdPortalBootstrapQueryOptions = {
  /** From RSC layout — hydrates the query so the AD shell does not block on GET `/api/app/bootstrap`. */
  initialData?: AppAdPortalBootstrapPayload | null
}

export function useAdPortalBootstrapQuery(opts?: UseAdPortalBootstrapQueryOptions) {
  const initial = opts?.initialData ?? undefined
  const generatedAtMs = initial?.generatedAt ? Date.parse(initial.generatedAt) : NaN

  return useQuery({
    queryKey: AD_PORTAL_BOOTSTRAP_QUERY_KEY,
    queryFn: () => fetchAdPortalBootstrap(),
    initialData: initial,
    initialDataUpdatedAt:
      initial && !Number.isNaN(generatedAtMs) ? generatedAtMs : initial ? Date.now() : undefined,
    staleTime: AD_PORTAL_BOOTSTRAP_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
}

/** Clears AD portal shell bootstrap cache. */
export function invalidateAdPortalBootstrap(queryClient: QueryClient): Promise<void> {
  return queryClient
    .invalidateQueries({ queryKey: AD_PORTAL_BOOTSTRAP_QUERY_KEY })
    .then(() => undefined)
}

export function isAdPortalBootstrapUnauthorizedError(e: unknown): boolean {
  return e instanceof AdPortalBootstrapUnauthorizedError
}

export function isAdPortalBootstrapForbiddenError(e: unknown): boolean {
  return e instanceof AdPortalBootstrapForbiddenError
}
