"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { StudyGuidesScaffold } from "@/components/portal/study-guides-scaffold"

export default function StudyGuidesPage() {
  return (
    <DashboardPageShell>
      {({ canEdit }) => <StudyGuidesScaffold canEdit={canEdit} />}
    </DashboardPageShell>
  )
}
