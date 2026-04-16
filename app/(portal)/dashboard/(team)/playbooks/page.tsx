"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybooksBrowse } from "@/components/portal/playbooks-browse"
import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"

export default function PlaybooksPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <PlaybooksPageInner teamId={teamId} canEdit={canEdit} />
      )}
    </DashboardPageShell>
  )
}

function PlaybooksPageInner({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const dashQ = useDashboardBootstrapQuery(teamId)
  const bootstrapCoreReady = dashQ.data ? dashQ.data.deferredPending === false : false
  const initialPlaybooksSummary = bootstrapCoreReady ? dashQ.data?.playbooksSummary : undefined

  return (
    <div className="min-h-[400px] lg:min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden max-w-full">
      <PlaybooksBrowse
        teamId={teamId}
        canEdit={canEdit}
        initialPlaybooksSummary={initialPlaybooksSummary}
        bootstrapCoreReady={bootstrapCoreReady}
      />
    </div>
  )
}
