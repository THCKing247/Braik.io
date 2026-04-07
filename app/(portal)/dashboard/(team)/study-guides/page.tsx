"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { StudyGuidesModule } from "@/components/portal/study-guides-module"

export default function StudyGuidesPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => <StudyGuidesModule teamId={teamId} canEdit={canEdit} />}
    </DashboardPageShell>
  )
}
