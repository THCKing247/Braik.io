"use client"

import { Suspense, useEffect } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { useRouter, useSearchParams } from "next/navigation"
import {
  DashboardPageShell,
  DashboardPageShellSkeleton,
} from "@/components/portal/dashboard-page-shell"
import { AdPortalLandingGate } from "@/components/portal/ad-portal-landing-gate"
import { TeamDashboard } from "@/components/portal/team-dashboard"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import { authTimingClient } from "@/lib/auth/login-flow-timing"

/**
 * Dashboard home: static import of TeamDashboard avoids an extra JS chunk + sequential dynamic loading
 * skeleton on top of shell/bootstrap (see PERFORMANCE_GUIDELINES.md).
 */

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const role = session?.user?.role
  const identity = useDashboardShellIdentity()

  useEffect(() => {
    authTimingClient("dashboard_home_mounted")
  }, [])

  useEffect(() => {
    if (status === "authenticated" && role === "ATHLETIC_DIRECTOR") {
      authTimingClient("dashboard_home_ad_redirect")
      fetch("/api/routing/organization-default", { credentials: "same-origin" })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: { path?: string } | null) => {
          router.replace(payload?.path || "/dashboard/ad")
        })
        .catch(() => {
          router.replace("/dashboard/ad")
        })
    }
  }, [status, role, router])

  useEffect(() => {
    const teamId = searchParams.get("teamId")?.trim()
    if (!teamId) return
    fetch(`/api/routing/team-canonical?teamId=${encodeURIComponent(teamId)}`, { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { path?: string } | null) => {
        if (payload?.path) router.replace(payload.path)
      })
      .catch(() => {
        // Keep legacy URL working if canonical lookup fails.
      })
  }, [searchParams, router])

  /**
   * Must match `DashboardPageShellContent` session gate: if shell/bootstrap already has user id, render
   * main content even while `useSession()` is still resolving — avoids an extra full skeleton beat.
   */
  const waitForMainContent =
    !identity.hasIdentity && status === "loading" && !session?.user?.id

  if (status === "authenticated" && !session?.user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm" style={{ borderColor: "rgb(var(--border))" }}>
          <h2 className="text-base font-semibold" style={{ color: "rgb(var(--text))" }}>Session data is incomplete</h2>
          <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
            We could not finish loading your account details. Please refresh the page or sign out and back in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<DashboardPageShellSkeleton />}>
      <AdPortalLandingGate>
        <DashboardPageShell>
          {({ teamId, canEdit }) =>
            waitForMainContent ? (
              <DashboardPageShellSkeleton />
            ) : (
              <TeamDashboard
                key={teamId || "no-team"}
                session={session}
                teamId={teamId}
                canAddCalendarEvents={canEdit}
              />
            )
          }
        </DashboardPageShell>
      </AdPortalLandingGate>
    </Suspense>
  )
}
