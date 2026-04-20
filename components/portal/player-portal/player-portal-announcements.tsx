"use client"

import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"
import { DashboardAnnouncementsCard } from "@/components/portal/dashboard-announcements-card"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"

export function PlayerPortalAnnouncements() {
  const { teamId, userId } = usePlayerPortal()
  const dashQ = useDashboardBootstrapQuery(teamId)

  return (
    <div className="rounded-2xl border border-white/40 bg-white p-3 shadow-xl sm:p-4">
      <DashboardAnnouncementsCard
        teamId={teamId}
        canCreate={false}
        viewerUserId={userId}
        viewerRole="PLAYER"
        bootstrapLoading={dashQ.isPending && !dashQ.data}
        initialAnnouncements={dashQ.data?.announcements}
      />
    </div>
  )
}
