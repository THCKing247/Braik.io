"use client"

import { useSession } from "@/lib/auth/client-auth"
import { DashboardPageShellSkeleton } from "@/components/portal/dashboard-page-shell"
import { CANONICAL_DASHBOARD_TEAM_PATH_RE } from "@/lib/navigation/organization-routes"
import { useAdPortalMeQuery } from "@/lib/api/me/ad-portal-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, type ReactNode } from "react"

/**
 * Varsity head coaches with football AD portal scope default to the organization portal unless they are
 * already on a team dashboard (`?teamId=` legacy or canonical `/dashboard/org/:shortOrgId/team/:shortTeamId`).
 *
 * Uses {@link AdPortalMeProvider} from dashboard shell (`AdPortalLinkProvider`) — no second query observer.
 */
export function AdPortalLandingGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const teamId = searchParams.get("teamId")

  const path = pathname ?? ""
  const onCanonicalTeamDashboard = CANONICAL_DASHBOARD_TEAM_PATH_RE.test(path)
  const needsAdPortalCheck =
    status === "authenticated" &&
    session?.user?.role?.toUpperCase() === "HEAD_COACH" &&
    !teamId &&
    !onCanonicalTeamDashboard

  const adPortalQuery = useAdPortalMeQuery({ enabled: needsAdPortalCheck })

  useEffect(() => {
    if (!needsAdPortalCheck || adPortalQuery.isPending) return
    const data = adPortalQuery.data
    if (data?.canEnterAdPortal && data.defaultPath) {
      router.replace(data.defaultPath)
    }
  }, [needsAdPortalCheck, adPortalQuery.isPending, adPortalQuery.data, router])

  if (status !== "authenticated") {
    if (status === "unauthenticated") return <>{children}</>
    return <DashboardLandingSkeleton />
  }

  if (session?.user?.role?.toUpperCase() !== "HEAD_COACH") {
    return <>{children}</>
  }

  if (teamId || onCanonicalTeamDashboard) {
    return <>{children}</>
  }

  if (adPortalQuery.isPending) {
    return <DashboardLandingSkeleton />
  }

  return <>{children}</>
}

function DashboardLandingSkeleton() {
  return (
    <div className="min-h-[50vh] w-full" aria-busy="true" aria-label="Loading dashboard">
      <DashboardPageShellSkeleton />
    </div>
  )
}

