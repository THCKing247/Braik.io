"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"
import { defaultDashboardEntryForPortal } from "@/lib/portal/dashboard-path"
import { isDashboardPathForbiddenForPortal } from "@/lib/permissions/dashboard-route-policy"

/**
 * Keeps non-coach portals from staying on routes they must not access (legacy `/dashboard/...` URLs).
 * Standalone `/player` / `/parent` tails are enforced separately by {@link FreePortalRouteEnforcer}.
 */
export function PortalRouteEnforcer({
  portalKind,
  children,
}: {
  portalKind: BraikPortalKind
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname) return
    if (!isDashboardPathForbiddenForPortal(portalKind, pathname)) return
    router.replace(defaultDashboardEntryForPortal(portalKind))
  }, [pathname, portalKind, router])

  return <>{children}</>
}
