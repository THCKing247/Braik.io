"use client"

import { useSession } from "@/lib/auth/client-auth"
import { DashboardPageShellSkeleton } from "@/components/portal/dashboard-page-shell"
import { CANONICAL_DASHBOARD_TEAM_PATH_RE } from "@/lib/navigation/organization-routes"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

/**
 * Varsity head coaches with football AD portal scope default to the organization portal unless they are
 * already on a team dashboard (`?teamId=` legacy or canonical `/dashboard/org/:shortOrgId/team/:shortTeamId`).
 */
export function AdPortalLandingGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const teamId = searchParams.get("teamId")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setReady(true)
      return
    }
    if (session?.user?.role?.toUpperCase() !== "HEAD_COACH") {
      setReady(true)
      return
    }
    const path = pathname ?? ""
    const onCanonicalTeamDashboard = CANONICAL_DASHBOARD_TEAM_PATH_RE.test(path)
    if (teamId || onCanonicalTeamDashboard) {
      setReady(true)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/me/ad-portal")
        if (!res.ok) {
          if (!cancelled) setReady(true)
          return
        }
        const data = (await res.json()) as { canEnterAdPortal?: boolean; defaultPath?: string }
        if (!cancelled && data.canEnterAdPortal && data.defaultPath) {
          router.replace(data.defaultPath)
          return
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [status, session, teamId, pathname, router])

  if (!ready) {
    return (
      <div className="min-h-[50vh] w-full" aria-busy="true" aria-label="Loading dashboard">
        <DashboardPageShellSkeleton />
      </div>
    )
  }

  return <>{children}</>
}
