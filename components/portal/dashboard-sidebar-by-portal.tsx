"use client"

import { DashboardSidebar } from "@/components/portal/dashboard-sidebar"
import { RecruiterDashboardSidebar } from "@/components/portal/recruiter-dashboard-sidebar"
import { usePortalShellKind } from "@/components/portal/portal-shell-context"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

export function DashboardSidebarByPortal({ teams }: { teams: Team[] }) {
  const kind = usePortalShellKind()
  if (kind === "recruiter") {
    return <RecruiterDashboardSidebar />
  }
  return <DashboardSidebar teams={teams} />
}
