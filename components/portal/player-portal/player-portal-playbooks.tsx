"use client"

import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"
import { PlaybooksBrowse } from "@/components/portal/playbooks-browse"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"

export function PlayerPortalPlaybooks() {
  const { teamId } = usePlayerPortal()
  const dashQ = useDashboardBootstrapQuery(teamId)
  const bootstrapCoreReady = dashQ.data ? dashQ.data.deferredPending === false : false

  return (
    <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/40 bg-white shadow-xl">
      <PlaybooksBrowse teamId={teamId} canEdit={false} bootstrapCoreReady={bootstrapCoreReady} />
    </div>
  )
}
