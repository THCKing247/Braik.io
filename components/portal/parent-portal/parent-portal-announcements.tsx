"use client"

import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"
import { DashboardAnnouncementsCard } from "@/components/portal/dashboard-announcements-card"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"

export function ParentPortalAnnouncements() {
  const { teamId, parentUserId } = useParentPortal()
  const dashQ = useDashboardBootstrapQuery(teamId)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <DashboardAnnouncementsCard
        teamId={teamId}
        canCreate={false}
        viewerUserId={parentUserId}
        viewerRole="PARENT"
        bootstrapLoading={dashQ.isPending && !dashQ.data}
        initialAnnouncements={dashQ.data?.announcements}
      />
    </div>
  )
}
