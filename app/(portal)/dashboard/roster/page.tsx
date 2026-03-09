"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { RosterManagerEnhanced } from "@/components/portal/roster-manager-enhanced"

export default function RosterPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit, userRole }) => (
        <RosterManagerEnhanced
          teamId={teamId}
          players={[]}
          canEdit={canEdit}
          teamSport="football"
          userRole={userRole}
        />
      )}
    </DashboardPageShell>
  )
}
