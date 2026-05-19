"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "@/lib/api/core/fetch-json"

export type AdPortalMeResponse = {
  canEnterAdPortal?: boolean
  mode?: string
  restrictedFootball?: boolean
  showOverviewAndSettings?: boolean
  shortOrgId?: string | null
  organizationPortalUuid?: string | null
  defaultPath?: string
}

export const adPortalMeQueryKey = ["me", "ad-portal"] as const

const AD_PORTAL_LINK_STORAGE_KEY = "braik_ad_portal_dept_href_v1"
const AD_PORTAL_LINK_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function readCachedAdPortalDefaultPath(): string | null {
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(AD_PORTAL_LINK_STORAGE_KEY) : null
    if (!raw) return null
    const parsed = JSON.parse(raw) as { href?: string; ts?: number }
    if (
      parsed.href &&
      typeof parsed.ts === "number" &&
      Date.now() - parsed.ts < AD_PORTAL_LINK_MAX_AGE_MS
    ) {
      return parsed.href
    }
  } catch {
    /* ignore */
  }
  return null
}

export function writeCachedAdPortalDefaultPath(href: string): void {
  try {
    sessionStorage.setItem(AD_PORTAL_LINK_STORAGE_KEY, JSON.stringify({ href, ts: Date.now() }))
  } catch {
    /* ignore */
  }
}

async function fetchAdPortalMe(): Promise<AdPortalMeResponse> {
  return fetchJson<AdPortalMeResponse>("/api/me/ad-portal", { credentials: "same-origin" })
}

/** Shared React Query cache for HEAD_COACH AD portal link + landing gate (one network call per session). */
export function useAdPortalMeQuery(opts: { enabled: boolean }) {
  const cachedPath = opts.enabled ? readCachedAdPortalDefaultPath() : null
  return useQuery({
    queryKey: adPortalMeQueryKey,
    queryFn: fetchAdPortalMe,
    enabled: opts.enabled,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: cachedPath
      ? ({ canEnterAdPortal: true, defaultPath: cachedPath } satisfies AdPortalMeResponse)
      : undefined,
    initialDataUpdatedAt: cachedPath ? Date.now() - 1000 : undefined,
  })
}
