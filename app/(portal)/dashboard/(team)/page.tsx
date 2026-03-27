"use client"

import dynamic from "next/dynamic"
import { Suspense, useEffect } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { AdPortalLandingGate } from "@/components/portal/ad-portal-landing-gate"

const TeamDashboard = dynamic(
  () => import("@/components/portal/team-dashboard").then((m) => m.TeamDashboard),
  {
    loading: () => (
      <div className="min-w-0 space-y-4 pb-4 md:space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="h-36 w-full animate-pulse rounded-2xl bg-[rgb(var(--platinum))] md:h-40" />
        <div className="h-52 w-full animate-pulse rounded-2xl bg-[rgb(var(--platinum))] md:rounded-lg" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
          <div className="h-64 animate-pulse rounded-2xl bg-[rgb(var(--platinum))] lg:col-span-4 md:rounded-lg" />
          <div className="h-64 animate-pulse rounded-2xl bg-[rgb(var(--platinum))] lg:col-span-5 md:rounded-lg" />
          <div className="h-64 animate-pulse rounded-2xl bg-[rgb(var(--platinum))] lg:col-span-3 md:rounded-lg" />
        </div>
      </div>
    ),
  }
)

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
