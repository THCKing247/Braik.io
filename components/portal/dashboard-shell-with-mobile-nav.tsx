"use client"

import type { ReactNode } from "react"
import { MobileDashboardNavProvider } from "@/components/portal/mobile-dashboard-nav-provider"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

export function DashboardShellWithMobileNav({
  teams,
  currentTeamId,
  children,
}: {
  teams: Team[]
  currentTeamId: string
  children: ReactNode
}) {
  const bootstrapTeamId = currentTeamId.trim() || teams[0]?.id || ""
  return (
    <MobileDashboardNavProvider teams={teams} bootstrapTeamId={bootstrapTeamId}>
      {children}
    </MobileDashboardNavProvider>
  )
}
