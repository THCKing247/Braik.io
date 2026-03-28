"use client"

import type { ReactNode } from "react"
import { MobileDashboardNavProvider } from "@/components/portal/mobile-dashboard-nav-provider"
import {
  DashboardTeamInner,
  DashboardTeamScopeSuspense,
} from "@/components/portal/dashboard-team-inner"

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
  return (
    <MobileDashboardNavProvider teams={teams}>
      <DashboardTeamScopeSuspense>
        <DashboardTeamInner teams={teams} serverCurrentTeamId={currentTeamId}>
          {children}
        </DashboardTeamInner>
      </DashboardTeamScopeSuspense>
    </MobileDashboardNavProvider>
  )
}
