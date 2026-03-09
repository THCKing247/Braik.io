"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { DocumentsManager } from "@/components/portal/documents-manager"

export default function DocumentsPage() {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, canEdit }) => (
        <DocumentsManager
          teamId={teamId}
          documents={[]}
          canUpload={canEdit}
          userRole={userRole}
        />
      )}
    </DashboardPageShell>
  )
}
