"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import {
  AdPortalMeProvider,
  useAdPortalMeQuery,
  writeCachedAdPortalDefaultPath,
} from "@/lib/api/me/ad-portal-query"

/**
 * HEAD_COACH → Athletic Department href from /api/me/ad-portal, cached in sessionStorage
 * and shared via React Query so landing gate + nav do not duplicate the request.
 */
type AdPortalLinkContextValue = {
  /** Default AD portal path when the coach may enter; null otherwise */
  departmentHref: string | null
  /** True after the (optional) request finished — avoids link flash for HC */
  ready: boolean
}

const AdPortalLinkContext = createContext<AdPortalLinkContextValue>({
  departmentHref: null,
  ready: false,
})

function AdPortalLinkProviderInner({ children }: { children: ReactNode }) {
  const identity = useDashboardShellIdentity()
  const isHeadCoach = identity.hasIdentity && identity.roleUpper === "HEAD_COACH"
  const query = useAdPortalMeQuery({ enabled: isHeadCoach })

  useEffect(() => {
    if (!query.data?.canEnterAdPortal || !query.data.defaultPath) return
    writeCachedAdPortalDefaultPath(query.data.defaultPath)
  }, [query.data])

  const departmentHref =
    isHeadCoach && query.data?.canEnterAdPortal && query.data.defaultPath
      ? query.data.defaultPath
      : null

  const ready = !isHeadCoach || !query.isPending

  const value = useMemo(
    () => ({ departmentHref, ready }),
    [departmentHref, ready]
  )

  return (
    <AdPortalLinkContext.Provider value={value}>{children}</AdPortalLinkContext.Provider>
  )
}

export function AdPortalLinkProvider({ children }: { children: ReactNode }) {
  const identity = useDashboardShellIdentity()
  const isHeadCoach = identity.hasIdentity && identity.roleUpper === "HEAD_COACH"
  return (
    <AdPortalMeProvider enabled={isHeadCoach}>
      <AdPortalLinkProviderInner>{children}</AdPortalLinkProviderInner>
    </AdPortalMeProvider>
  )
}

export function useAdPortalDepartmentLink(): AdPortalLinkContextValue {
  return useContext(AdPortalLinkContext)
}
