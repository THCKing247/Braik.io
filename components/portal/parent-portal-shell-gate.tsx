"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  useDashboardShellQuery,
  isDashboardShellUnauthorizedError,
} from "@/lib/dashboard/dashboard-shell-query"
import type { DashboardShellPayload } from "@/lib/dashboard/dashboard-shell-payload"
import { DashboardShellLoadingSkeleton } from "@/components/portal/dashboard-shell-loading-skeleton"
import { DashboardLayoutFallback } from "@/components/portal/dashboard-layout-fallback"
import { FreePortalRouteEnforcer } from "@/components/portal/free-portal-route-enforcer"
import { normalizePlayerAccountIdSegment } from "@/lib/roster/resolve-roster-player-segment"
import { ParentPortalProvider } from "@/components/portal/parent-portal/parent-portal-context"
import { ParentPortalChrome } from "@/components/portal/parent-portal/parent-portal-chrome"

export function ParentPortalShellGate({
  urlLinkSegment,
  children,
}: {
  urlLinkSegment: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const q = useDashboardShellQuery()

  useEffect(() => {
    if (!q.isError || !q.error) return
    if (!isDashboardShellUnauthorizedError(q.error)) return
    const dest = pathname || "/parent"
    router.replace(`/login?callbackUrl=${encodeURIComponent(dest)}`)
  }, [q.isError, q.error, router, pathname])

  useEffect(() => {
    const payload = q.data as DashboardShellPayload | undefined
    if (!payload || payload.shellMode !== "full") return
    if (payload.portalKind !== "parent") {
      const d = payload.user.defaultAppPath
      router.replace(
        d && d.startsWith("/") && !d.startsWith("//") ? d : "/login"
      )
    }
  }, [q.data, router])

  useEffect(() => {
    const payload = q.data as DashboardShellPayload | undefined
    if (!payload || payload.shellMode !== "full" || payload.portalKind !== "parent") return
    const canonical = payload.parentPortalSegment
    if (!canonical) return
    if (normalizePlayerAccountIdSegment(urlLinkSegment) !== normalizePlayerAccountIdSegment(canonical)) {
      router.replace(`/parent/${encodeURIComponent(canonical)}`)
    }
  }, [q.data, router, urlLinkSegment])

  if (q.isError && isDashboardShellUnauthorizedError(q.error)) {
    return <DashboardShellLoadingSkeleton />
  }

  if (q.isPending && !q.data) {
    return <DashboardShellLoadingSkeleton />
  }

  if (q.isError) {
    return <DashboardLayoutFallback />
  }

  const payload = q.data
  if (!payload) return <DashboardShellLoadingSkeleton />

  if (payload.shellMode !== "full") {
    return <DashboardShellLoadingSkeleton />
  }

  if (payload.portalKind !== "parent") {
    return <DashboardShellLoadingSkeleton />
  }

  const segment = payload.parentPortalSegment ?? urlLinkSegment
  const baseHref = `/parent/${encodeURIComponent(segment)}`

  const currentTeam =
    payload.teams.find((t) => t.id === payload.currentTeamId) ?? payload.teams[0] ?? null
  const teamStatus = payload.currentTeamStatus ?? currentTeam?.teamStatus

  const su = payload.user
  const userName = su.name?.trim() || null
  const userEmail = su.email ?? null

  return (
    <FreePortalRouteEnforcer portalKind="parent" portalBaseHref={baseHref}>
      <ParentPortalProvider
        linkCodeSegment={segment}
        shellParentDisplayName={userName}
        shellParentEmail={userEmail}
      >
        <ParentPortalChrome teamStatus={teamStatus}>{children}</ParentPortalChrome>
      </ParentPortalProvider>
    </FreePortalRouteEnforcer>
  )
}
