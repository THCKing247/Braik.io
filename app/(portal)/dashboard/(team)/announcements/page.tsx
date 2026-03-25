"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { AnnouncementsManager } from "@/components/portal/announcements-manager"

export default function AnnouncementsPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit, userId, userRole }) => (
        <AnnouncementsManager
          teamId={teamId}
          canPost={canEdit}
          viewerUserId={userId}
          viewerRole={userRole}
        />
      )}
    </DashboardPageShell>
  )
}
