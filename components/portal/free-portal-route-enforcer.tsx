"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"
import { isFreePortalPathForbiddenForPortal } from "@/lib/permissions/dashboard-route-policy"

/** Redirects player/parent away from forbidden tails under `/player/:id` or `/parent/:code` (same rules as prefixed dashboard URLs). */
export function FreePortalRouteEnforcer({
  portalKind,
  portalBaseHref,
  children,
}: {
  portalKind: BraikPortalKind
  portalBaseHref: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname) return
    if (!isFreePortalPathForbiddenForPortal(portalKind, pathname)) return
    router.replace(portalBaseHref)
  }, [pathname, portalKind, portalBaseHref, router])

  return <>{children}</>
}
