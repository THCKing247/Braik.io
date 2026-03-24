"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useSession } from "@/lib/auth/client-auth"

/**
 * One fetch per dashboard shell mount for HEAD_COACH → Athletic Department link.
 * Lives under the persistent dashboard layout so internal navigations do not
 * re-hit /api/me/ad-portal on every route change (Nav previously used useEffect per mount).
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
  const { data: session, status } = useSession()
  const userRole = session?.user?.role?.toUpperCase() ?? ""
  const [departmentHref, setDepartmentHref] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (status !== "authenticated" || userRole !== "HEAD_COACH") {
      setDepartmentHref(null)
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)

    // Defer until idle so first paint / route transition is not competing with this request.
    const run = () => {
      if (cancelled) return
      fetch("/api/me/ad-portal")
        .then((r) => r.json())
        .then((d: { canEnterAdPortal?: boolean; defaultPath?: string }) => {
          if (cancelled) return
          if (d.canEnterAdPortal && d.defaultPath) setDepartmentHref(d.defaultPath)
          else setDepartmentHref(null)
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
  }, [status, userRole])

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
