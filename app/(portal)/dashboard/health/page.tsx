"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { HealthManager } from "@/components/portal/health-manager"

export default function HealthPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => <HealthManager teamId={teamId} />}
    </DashboardPageShell>
  )
}
