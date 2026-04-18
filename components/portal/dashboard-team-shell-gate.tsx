"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { seedAuthSessionCacheFromShellUser } from "@/lib/auth/client-auth"
import type { DashboardShellPayload } from "@/lib/dashboard/dashboard-shell-payload"
import {
  isDashboardShellUnauthorizedError,
  useDashboardShellQuery,
} from "@/lib/dashboard/dashboard-shell-query"
import { DashboardNav } from "@/components/portal/dashboard-nav"
import { SubscriptionGuard } from "@/components/portal/subscription-guard"
import { DashboardLayoutClient } from "@/components/portal/dashboard-layout-client"
import { DashboardShellWithMobileNav } from "@/components/portal/dashboard-shell-with-mobile-nav"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { CoachPageDebug } from "@/components/portal/coach-page-debug"
import { DashboardLayoutFallback } from "@/components/portal/dashboard-layout-fallback"
import { DashboardShellLoadingSkeleton } from "@/components/portal/dashboard-shell-loading-skeleton"
import { PortalShellProvider } from "@/components/portal/portal-shell-context"
import { PortalRouteEnforcer } from "@/components/portal/portal-route-enforcer"

/**
 * First paint: one GET /api/dashboard/shell (React Query). Downstream pages should consume
 * bootstrap/shell payloads instead of duplicating the same data with ad-hoc fetches.
 * PERFORMANCE_GUIDELINES.md — fetching rules.
 */
export function DashboardTeamShellGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const q = useDashboardShellQuery()

  useEffect(() => {
    if (!q.isError || !q.error) return
    if (!isDashboardShellUnauthorizedError(q.error)) return
    const dest = pathname || "/dashboard"
    router.replace(`/login?callbackUrl=${encodeURIComponent(dest)}`)
  }, [q.isError, q.error, router, pathname])

  useEffect(() => {
    const payload = q.data as DashboardShellPayload | undefined
    if (payload?.user?.id) {
      seedAuthSessionCacheFromShellUser(queryClient, payload.user)
    }
  }, [q.data, queryClient])

  useEffect(() => {
    const payload = q.data
    if (!payload || payload.shellMode !== "full") return
    const layoutUserRole = payload.user.role?.toUpperCase()
    if (
      payload.teams.length === 0 &&
      layoutUserRole === "HEAD_COACH" &&
      !payload.user.isPlatformOwner &&
      payload.portalKind !== "recruiter"
    ) {
      router.replace("/onboarding")
    }
  }, [q.data, router])

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
  if (!payload) {
    return <DashboardShellLoadingSkeleton />
  }

  if (payload.shellMode === "ad-delegate") {
    return <>{children}</>
  }

  const {
    user,
    portalKind,
    teams,
    currentTeamId,
    impersonation,
    subscriptionPaid,
    remainingBalance,
    currentTeamStatus,
  } = payload

  const layoutUserRole = user.role?.toUpperCase()
  if (
    teams.length === 0 &&
    layoutUserRole === "HEAD_COACH" &&
    !user.isPlatformOwner &&
    portalKind !== "recruiter"
  ) {
    return <DashboardShellLoadingSkeleton />
  }

  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]

  return (
    <PortalShellProvider portalKind={portalKind}>
      <PortalRouteEnforcer portalKind={portalKind}>
        <DashboardShellWithMobileNav teams={teams} currentTeamId={currentTeamId}>
          <div className="app-shell dashboard-app-shell flex min-h-screen flex-col bg-background">
            <header className="shrink-0">
              <DashboardNav teams={teams} />
            </header>
            <DashboardLayoutClient
              teams={teams}
              currentTeamId={currentTeamId}
              className="flex w-full min-w-0 flex-col lg:flex-1 lg:min-h-0"
            >
              {process.env.NODE_ENV === "development" && portalKind === "coach" ? (
                <CoachPageDebug session={{ user }} teamIds={teams.map((t) => t.id)} accessAllowed={true} />
              ) : null}
              {impersonation ? <ImpersonationBanner /> : null}
              <SuspensionBanner teamStatus={currentTeamStatus ?? currentTeam?.teamStatus} role={user.role} />
              <SubscriptionGuard subscriptionPaid={subscriptionPaid} remainingBalance={remainingBalance}>
                {children}
              </SubscriptionGuard>
            </DashboardLayoutClient>
          </div>
        </DashboardShellWithMobileNav>
      </PortalRouteEnforcer>
    </PortalShellProvider>
  )
}
