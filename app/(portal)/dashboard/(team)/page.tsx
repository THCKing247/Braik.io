"use client"

import { Suspense, useEffect } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { useRouter } from "next/navigation"
import {
  DashboardPageShell,
  DashboardPageShellSkeleton,
} from "@/components/portal/dashboard-page-shell"
import { AdPortalLandingGate } from "@/components/portal/ad-portal-landing-gate"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { TeamDashboard } from "@/components/portal/team-dashboard"

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = session?.user?.role

  useEffect(() => {
    authTimingClient("dashboard_home_mounted")
  }, [])

  useEffect(() => {
    if (status === "authenticated" && role === "ATHLETIC_DIRECTOR") {
      authTimingClient("dashboard_home_ad_redirect")
      router.replace("/dashboard/ad")
    }
  }, [status, role, router])

  /** Cookie + middleware already gate /dashboard; avoid blanking the whole home on brief session hydration. */
  const waitForSession = status === "loading" && !session?.user?.id

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
            waitForSession ? (
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
