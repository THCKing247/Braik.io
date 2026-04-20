"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  kickDeferredCoreMerge,
  useDashboardBootstrapQuery,
} from "@/lib/dashboard/dashboard-bootstrap-query"
import { StudyGuidesModule } from "@/components/portal/study-guides-module"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"

export function PlayerPortalStudyGuides() {
  const { teamId } = usePlayerPortal()
  const queryClient = useQueryClient()
  const dashQ = useDashboardBootstrapQuery(teamId)

  useEffect(() => {
    const t = teamId.trim()
    if (!t || !dashQ.data?.deferredPending) return
    kickDeferredCoreMerge(t, queryClient)
  }, [teamId, dashQ.data?.deferredPending, queryClient])

  return (
    <div className="min-h-[480px] rounded-2xl border border-white/40 bg-white p-4 shadow-xl sm:p-6">
      <StudyGuidesModule teamId={teamId} canEdit={false} />
    </div>
  )
}
