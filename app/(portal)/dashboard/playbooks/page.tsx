"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookWorkspace } from "@/components/portal/playbook-workspace"

export default function PlaybooksPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <PlaybookWorkspace
          teamId={teamId}
          canEdit={canEdit}
          canEditOffense={canEdit}
          canEditDefense={canEdit}
          canEditSpecialTeams={canEdit}
        />
      )}
    </DashboardPageShell>
  )
}
