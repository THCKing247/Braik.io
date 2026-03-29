"use client"

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
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

export const BRAIK_AD_PORTAL_BOOTSTRAP_QUERY_KEY = ["braik-ad-portal-bootstrap"] as const

const AD_BOOTSTRAP_STALE_MS = 2 * 60 * 1000

export async function fetchAdPortalBootstrap(): Promise<AppAdPortalBootstrapPayload> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0
  authTimingClient("ad_portal_bootstrap_query_fetch_start")
  navPerfDev("ad_portal_bootstrap_fetch_start")

  const res = await fetch("/api/app/bootstrap?portal=ad", {
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
  })
  return payload
}

export function useAdPortalBootstrapQuery() {
  return useQuery({
    queryKey: BRAIK_AD_PORTAL_BOOTSTRAP_QUERY_KEY,
    queryFn: fetchAdPortalBootstrap,
    staleTime: AD_BOOTSTRAP_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
}

export function invalidateAdPortalBootstrap(queryClient: QueryClient): Promise<void> {
  return queryClient
    .invalidateQueries({ queryKey: BRAIK_AD_PORTAL_BOOTSTRAP_QUERY_KEY })
    .then(() => undefined)
}

export function isAdPortalBootstrapUnauthorizedError(e: unknown): boolean {
  return e instanceof AdPortalBootstrapUnauthorizedError
}

export function isAdPortalBootstrapForbiddenError(e: unknown): boolean {
  return e instanceof AdPortalBootstrapForbiddenError
}
