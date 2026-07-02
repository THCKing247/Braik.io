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
import { teamScopedDashboardHref } from "@/lib/portal/dashboard-path"

/**
 * Coach / recruiter **team dashboard** chrome (sidebar, coach nav). Player and parent roles should prefer
 * standalone portals at `/player/:accountId` and `/parent/:linkCode` — do not reuse this shell for those UIs.
 *
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
    // Only redirect a HEAD_COACH to onboarding when they have no teams AND no profile team_id.
    // A non-null teamId means they have a historical team association (even if the shell
    // couldn't resolve it), so they are an existing coach — not a brand-new user.
    if (
      payload.teams.length === 0 &&
      !payload.user.teamId &&
      layoutUserRole === "HEAD_COACH" &&
      !payload.user.isPlatformOwner &&
      payload.portalKind !== "recruiter"
    ) {
      router.replace("/onboarding")
    }
  }, [q.data, router])

  useEffect(() => {
    const payload = q.data
    if (!payload || payload.shellMode !== "full") return
    const role = payload.user.role?.toUpperCase()
    const currentTeam = payload.teams.find((t) => t.id === payload.currentTeamId) || payload.teams[0]
    const currentShortIds =
      currentTeam?.shortOrgId && currentTeam?.shortTeamId
        ? { shortOrgId: currentTeam.shortOrgId, shortTeamId: currentTeam.shortTeamId }
        : null
    const nextHrefs: string[] = []

    if (role === "ATHLETIC_DIRECTOR") {
      nextHrefs.push("/dashboard/ad/teams", "/dashboard/ad/coaches")
    } else if (payload.portalKind === "recruiter") {
      nextHrefs.push("/dashboard/recruiter", "/dashboard/recruiter/recruiting")
      // TODO(Phase 5): Tune recruiter prefetch targets once recruiting IA settles.
    } else {
      nextHrefs.push(
        teamScopedDashboardHref(payload.portalKind, "/roster", currentShortIds),
        teamScopedDashboardHref(payload.portalKind, "/schedule", currentShortIds),
        teamScopedDashboardHref(payload.portalKind, "/messages", currentShortIds)
      )
    }

    const win = window as typeof window & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    const idleCb = win.requestIdleCallback
    const prefetch = () => {
      for (const href of nextHrefs) {
        router.prefetch(href)
      }
    }
    if (typeof idleCb === "function") {
      const id = idleCb(prefetch)
      return () => win.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(prefetch, 300)
    return () => window.clearTimeout(t)
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
    !user.teamId &&
    layoutUserRole === "HEAD_COACH" &&
    !user.isPlatformOwner &&
    portalKind !== "recruiter"
  ) {
    return <DashboardShellLoadingSkeleton />
  }

  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]

  return (
    <PortalShellProvider portalKind={portalKind}>
      <PortalRouteEnforcer portalKind={portalKind} portalHomeHref={user.defaultAppPath}>
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
              <SuspensionBanner teamStatus={currentTeamStatus ?? currentTeam?.teamStatus} />
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
