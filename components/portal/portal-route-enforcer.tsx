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
  /** Server-resolved home (e.g. `/player/:id`); required for player/parent so redirects never stay under `/dashboard`. */
  portalHomeHref,
  children,
}: {
  portalKind: BraikPortalKind
  portalHomeHref?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname) return
    if (!isDashboardPathForbiddenForPortal(portalKind, pathname)) return
    const dest =
      portalHomeHref && portalHomeHref.startsWith("/") && !portalHomeHref.startsWith("//")
        ? portalHomeHref
        : defaultDashboardEntryForPortal(portalKind)
    router.replace(dest)
  }, [pathname, portalKind, portalHomeHref, router])

  return <>{children}</>
}
