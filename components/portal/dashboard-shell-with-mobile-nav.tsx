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
  showAdminLink,
  children,
}: {
  teams: Team[]
  showAdminLink?: boolean
  children: ReactNode
}) {
  return (
    <MobileDashboardNavProvider teams={teams} showAdminLink={showAdminLink}>
      {children}
    </MobileDashboardNavProvider>
  )
}
