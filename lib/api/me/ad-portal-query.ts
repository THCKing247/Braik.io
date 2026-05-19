"use client"

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
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

type AdPortalMeContextValue = {
  query: UseQueryResult<AdPortalMeResponse, Error>
}

const AdPortalMeContext = createContext<AdPortalMeContextValue | null>(null)

/**
 * Single React Query observer for /api/me/ad-portal (landing gate + nav share one network call).
 * Mount once under dashboard team shell (`UrlResolvedTeamBootstrap`).
 */
export function AdPortalMeProvider({
  children,
  enabled,
}: {
  children: ReactNode
  enabled: boolean
}) {
  const cachedPath = enabled ? readCachedAdPortalDefaultPath() : null
  const query = useQuery({
    queryKey: adPortalMeQueryKey,
    queryFn: fetchAdPortalMe,
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: cachedPath
      ? ({ canEnterAdPortal: true, defaultPath: cachedPath } satisfies AdPortalMeResponse)
      : undefined,
    initialDataUpdatedAt: cachedPath ? Date.now() : undefined,
  })

  const value = useMemo(() => ({ query }), [query])
  return createElement(AdPortalMeContext.Provider, { value }, children)
}

/** Consumers must be under {@link AdPortalMeProvider}. `opts.enabled` is informational only — fetch is owned by the provider. */
export function useAdPortalMeQuery(_opts: { enabled: boolean }): UseQueryResult<AdPortalMeResponse, Error> {
  const ctx = useContext(AdPortalMeContext)
  if (!ctx) {
    throw new Error("useAdPortalMeQuery must be used within AdPortalMeProvider")
  }
  return ctx.query
}
