"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybooksBrowse } from "@/components/portal/playbooks-browse"

export default function PlaybooksPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <div className="min-h-[400px] lg:min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden max-w-full">
          <PlaybooksBrowse teamId={teamId} canEdit={canEdit} />
        </div>
      )}
    </DashboardPageShell>
  )
}
