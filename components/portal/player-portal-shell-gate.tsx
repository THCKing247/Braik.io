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
import { PlayerPortalProvider } from "@/components/portal/player-portal/player-portal-context"
import { PlayerPortalChrome } from "@/components/portal/player-portal/player-portal-chrome"

export function PlayerPortalShellGate({
  urlAccountSegment,
  children,
}: {
  urlAccountSegment: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const q = useDashboardShellQuery()

  useEffect(() => {
    if (!q.isError || !q.error) return
    if (!isDashboardShellUnauthorizedError(q.error)) return
    const dest = pathname || "/player"
    router.replace(`/login?callbackUrl=${encodeURIComponent(dest)}`)
  }, [q.isError, q.error, router, pathname])

  useEffect(() => {
    const payload = q.data as DashboardShellPayload | undefined
    if (!payload || payload.shellMode !== "full") return
    if (payload.portalKind !== "player") {
      router.replace(payload.user.defaultAppPath || "/dashboard")
    }
  }, [q.data, router])

  useEffect(() => {
    const payload = q.data as DashboardShellPayload | undefined
    if (!payload || payload.shellMode !== "full" || payload.portalKind !== "player") return
    const canonical = payload.playerAccountSegment
    if (!canonical) return
    if (normalizePlayerAccountIdSegment(urlAccountSegment) !== normalizePlayerAccountIdSegment(canonical)) {
      router.replace(`/player/${encodeURIComponent(canonical)}`)
    }
  }, [q.data, router, urlAccountSegment])

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

  if (payload.portalKind !== "player") {
    return <DashboardShellLoadingSkeleton />
  }

  const segment = payload.playerAccountSegment ?? urlAccountSegment
  const baseHref = `/player/${encodeURIComponent(segment)}`

  const currentTeam =
    payload.teams.find((t) => t.id === payload.currentTeamId) ?? payload.teams[0] ?? null
  const teamName = currentTeam?.name ?? "Team"
  const sport = currentTeam?.sport ?? ""

  const su = payload.user
  const userName = su.name?.trim() || null
  const userEmail = su.email ?? null

  return (
    <FreePortalRouteEnforcer portalKind="player" portalBaseHref={baseHref}>
      <PlayerPortalProvider
        accountSegment={segment}
        teamId={payload.currentTeamId}
        teamName={teamName}
        sport={sport}
        userId={su.id}
        userName={userName}
        userEmail={userEmail}
      >
        <PlayerPortalChrome>{children}</PlayerPortalChrome>
      </PlayerPortalProvider>
    </FreePortalRouteEnforcer>
  )
}
