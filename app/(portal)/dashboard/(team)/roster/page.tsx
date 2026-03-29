"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import {
  kickDeferredCoreMerge,
  useDashboardBootstrapQuery,
} from "@/lib/dashboard/dashboard-bootstrap-query"

const RosterManagerEnhanced = dynamic(
  () => import("@/components/portal/roster-manager-enhanced").then((m) => m.RosterManagerEnhanced),
  {
    loading: () => (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden">
        <div className="lg:hidden">
          <div className="sticky top-0 z-10 mb-4 space-y-3 border-b border-border bg-background/95 py-3 backdrop-blur-md">
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    ),
  }
)

export default function RosterPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit, userRole }) => (
        <RosterPageContent teamId={teamId} canEdit={canEdit} userRole={userRole} />
      )}
    </DashboardPageShell>
  )
}

function RosterPageContent({
  teamId,
  canEdit,
  userRole,
}: {
  teamId: string
  canEdit: boolean
  userRole: string
}) {
  const searchParams = useSearchParams()
  const initialView = (searchParams.get("view") === "list" ? "list" : "card") as "card" | "list"
  const initialSearch = searchParams.get("q") ?? ""
  const initialPosition = searchParams.get("position") ?? ""
  const tabParam = searchParams.get("tab")
  const initialTab =
    tabParam === "readiness" || tabParam === "depth-chart" || tabParam === "program-depth"
      ? tabParam
      : "roster"
  type PlayerItem = {
    id: string
    firstName: string
    lastName: string
    grade: number | null
    jerseyNumber: number | null
    positionGroup: string | null
    status: string
    notes: string | null
    imageUrl?: string | null
    secondaryPosition?: string | null
    updatedAt?: string | null
    user: { email: string } | null
    guardianLinks: Array<{ guardian: { user: { email: string } } }>
  }
  const queryClient = useQueryClient()
  const bootstrapQ = useDashboardBootstrapQuery(teamId)

  useEffect(() => {
    const t = teamId.trim()
    if (!t || !bootstrapQ.data?.deferredPending) return
    kickDeferredCoreMerge(t, queryClient)
  }, [teamId, bootstrapQ.data?.deferredPending, queryClient])

  const players = useMemo((): PlayerItem[] => {
    const r = bootstrapQ.data?.roster
    if (!Array.isArray(r)) return []
    return (r as Record<string, unknown>[]).map((p) => ({
      ...p,
      guardianLinks: Array.isArray(p.guardianLinks) ? p.guardianLinks : [],
    })) as PlayerItem[]
  }, [bootstrapQ.data?.roster])

  const programId = bootstrapQ.data?.dashboard?.team?.programId ?? null
  const rosterAwaitingDeferred = Boolean(bootstrapQ.data?.deferredPending)
  const blockingLoad = bootstrapQ.isPending && !bootstrapQ.data
  const prefetchedReadinessDetail = bootstrapQ.data?.readinessDetail ?? null

  if (blockingLoad) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-4 py-4 lg:px-0" aria-busy="true" aria-label="Loading roster">
        <div className="mb-4 h-10 w-48 animate-pulse rounded-lg bg-muted lg:mb-6" />
        <div className="h-72 w-full animate-pulse rounded-xl bg-muted lg:h-80" />
      </div>
    )
  }

  return (
    <RosterManagerEnhanced
      teamId={teamId}
      programId={programId}
      players={players}
      canEdit={canEdit}
      teamSport="football"
      userRole={userRole}
      initialView={initialView}
      initialSearch={initialSearch}
      initialPosition={initialPosition}
      initialTab={initialTab}
      prefetchedReadinessDetail={prefetchedReadinessDetail}
      rosterBootstrapPending={rosterAwaitingDeferred}
    />
  )
}
