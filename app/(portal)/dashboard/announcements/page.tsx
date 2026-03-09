"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { AnnouncementsManager } from "@/components/portal/announcements-manager"

export default function AnnouncementsPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <AnnouncementsManager
          teamId={teamId}
          announcements={[]}
          canPost={canEdit}
        />
      )}
    </DashboardPageShell>
  )
}
