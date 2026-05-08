"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  const identity = useDashboardShellIdentity()

  useEffect(() => {
    authTimingClient("dashboard_home_mounted")
  }, [])

  useEffect(() => {
    if (identity.hasIdentity && identity.roleUpper === "ATHLETIC_DIRECTOR") {
      authTimingClient("dashboard_home_ad_redirect")
      // TECH_DEBT: Move to a small `lib/api-client` / routing helper or hook (TECH_DEBT_GUARDRAILS.md §1).
      fetch("/api/routing/organization-default", { credentials: "same-origin" })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: { path?: string } | null) => {
          router.replace(payload?.path ?? "/dashboard")
        })
        .catch(() => {
          router.replace("/dashboard")
        })
    }
  }, [identity.hasIdentity, identity.roleUpper, router])

  // Legacy `?teamId=` → canonical `/dashboard/org/...` is handled in middleware (avoids client redirect races).

  return (
    <Suspense fallback={<DashboardPageShellSkeleton />}>
      <AdPortalLandingGate>
        <DashboardPageShell>
          {({ teamId, canEdit }) => (
            <TeamDashboard
              key={teamId || "no-team"}
              session={null}
              teamId={teamId}
              canAddCalendarEvents={canEdit}
            />
          )}
        </DashboardPageShell>
      </AdPortalLandingGate>
    </Suspense>
  )
}
