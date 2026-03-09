"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { ScheduleManager } from "@/components/portal/schedule-manager"

export default function SchedulePage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <ScheduleManager teamId={teamId} events={[]} canEdit={canEdit} defaultView="week" />
      )}
    </DashboardPageShell>
  )
}
