"use client"

import { Suspense, useEffect } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { TeamDashboard } from "@/components/portal/team-dashboard"
import { AdPortalLandingGate } from "@/components/portal/ad-portal-landing-gate"

export const dynamic = "force-dynamic"

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = session?.user?.role

  useEffect(() => {
    if (status === "authenticated" && role === "ATHLETIC_DIRECTOR") {
      router.replace("/dashboard/ad")
    }
  }, [status, role, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
      </div>
    )
  }

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
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
        </div>
      }
    >
      <AdPortalLandingGate>
        <DashboardPageShell>
          {({ teamId, canEdit }) => (
            <TeamDashboard
              session={session}
              teamId={teamId}
              canAddCalendarEvents={canEdit}
            />
          )}
        </DashboardPageShell>
      </AdPortalLandingGate>
    </Suspense>
  )
}
