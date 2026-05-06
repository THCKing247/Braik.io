"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { AdPortalLandingGate } from "@/components/portal/ad-portal-landing-gate"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { TeamDashboard } from "@/components/portal/team-dashboard"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"

export default function DashboardPage() {
  const router = useRouter()
  const identity = useDashboardShellIdentity()

  const dashboardSession = useMemo(() => {
    if (!identity.hasIdentity) return null
    const rawUser = identity.sessionUser
    return {
      user: {
        id: identity.userId,
        email: identity.email,
        name: identity.displayName ?? rawUser?.name ?? null,
        role: identity.roleUpper,
        teamId: rawUser?.teamId,
        teamName: rawUser?.teamName,
        organizationName: rawUser?.organizationName,
      },
    }
  }, [
    identity.displayName,
    identity.email,
    identity.hasIdentity,
    identity.roleUpper,
    identity.sessionUser,
    identity.userId,
  ])

  useEffect(() => {
    authTimingClient("dashboard_home_mounted")
  }, [])

  useEffect(() => {
    if (identity.hasIdentity && identity.roleUpper === "ATHLETIC_DIRECTOR") {
      authTimingClient("dashboard_home_ad_redirect")
      router.replace("/dashboard/ad")
    }
  }, [identity.hasIdentity, identity.roleUpper, router])

  if (identity.sessionStatus === "authenticated" && !identity.hasIdentity) {
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
    <AdPortalLandingGate>
      <DashboardPageShell>
        {({ teamId, canEdit }) => (
          <TeamDashboard
            key={teamId || "no-team"}
            session={dashboardSession}
            teamId={teamId}
            canAddCalendarEvents={canEdit}
          />
        )}
      </DashboardPageShell>
    </AdPortalLandingGate>
  )
}
