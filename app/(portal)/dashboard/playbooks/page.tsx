"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybooksPageClient } from "@/components/portal/playbooks-page-client"

export default function PlaybooksPage() {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, canEdit }) => (
        <PlaybooksPageClient
          teamId={teamId}
          fileBasedPlaybooks={[]}
          builderPlays={[]}
          canUpload={canEdit}
          canEditAll={canEdit}
          canEditOffense={canEdit}
          canEditDefense={canEdit}
          canEditSpecialTeams={canEdit}
          userRole={userRole}
        />
      )}
    </DashboardPageShell>
  )
}
