"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"

const AD_PORTAL_LINK_STORAGE_KEY = "braik_ad_portal_dept_href_v1"
const AD_PORTAL_LINK_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * HEAD_COACH → Athletic Department href from /api/me/ad-portal, cached in sessionStorage
 * so repeat dashboard sessions skip the network call. First visit still loads after idle.
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

export function AdPortalLinkProvider({ children }: { children: ReactNode }) {
  const identity = useDashboardShellIdentity()
  const [departmentHref, setDepartmentHref] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!identity.hasIdentity || identity.roleUpper !== "HEAD_COACH") {
      setDepartmentHref(null)
      setReady(true)
      return
    }

    let cancelled = false

    try {
      const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(AD_PORTAL_LINK_STORAGE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw) as { href?: string; ts?: number }
        if (
          parsed.href &&
          typeof parsed.ts === "number" &&
          Date.now() - parsed.ts < AD_PORTAL_LINK_MAX_AGE_MS
        ) {
          setDepartmentHref(parsed.href)
          setReady(true)
          return
        }
      }
    } catch {
      /* ignore */
    }

    setReady(false)

    const run = () => {
      if (cancelled) return
      fetch("/api/me/ad-portal")
        .then((r) => r.json())
        .then((d: { canEnterAdPortal?: boolean; defaultPath?: string }) => {
          if (cancelled) return
          if (d.canEnterAdPortal && d.defaultPath) {
            setDepartmentHref(d.defaultPath)
            try {
              sessionStorage.setItem(
                AD_PORTAL_LINK_STORAGE_KEY,
                JSON.stringify({ href: d.defaultPath, ts: Date.now() })
              )
            } catch {
              /* ignore */
            }
          } else {
            setDepartmentHref(null)
          }
          setReady(true)
        })
        .catch(() => {
          if (!cancelled) {
            setDepartmentHref(null)
            setReady(true)
          }
        })
    }

    let idleHandle: number | undefined
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleHandle = window.requestIdleCallback(() => run(), { timeout: 2500 })
    } else {
      timeoutHandle = setTimeout(run, 1)
    }

    return () => {
      cancelled = true
      if (idleHandle !== undefined && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    }
  }, [identity.hasIdentity, identity.roleUpper])

  const value = useMemo(
    () => ({ departmentHref, ready }),
    [departmentHref, ready]
  )

  return (
    <AdPortalLinkContext.Provider value={value}>{children}</AdPortalLinkContext.Provider>
  )
}

export function useAdPortalDepartmentLink(): AdPortalLinkContextValue {
  return useContext(AdPortalLinkContext)
}
