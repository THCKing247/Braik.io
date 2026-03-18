"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { RosterManagerEnhanced } from "@/components/portal/roster-manager-enhanced"
import { RosterMobileSkeleton } from "@/components/portal/roster-mobile-view"

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
  const [players, setPlayers] = useState<PlayerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [programId, setProgramId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}`).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/teams/${teamId}`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([rosterData, teamData]: [unknown, { programId?: string } | null]) => {
        if (!cancelled && Array.isArray(rosterData)) {
          setPlayers(
            (rosterData as Record<string, unknown>[]).map((p) => ({
              ...p,
              guardianLinks: Array.isArray(p.guardianLinks) ? p.guardianLinks : [],
            })) as PlayerItem[]
          )
        }
        if (!cancelled && teamData?.programId) {
          setProgramId(teamData.programId)
        } else if (!cancelled) {
          setProgramId(null)
        }
      })
      .catch(() => {
        if (!cancelled) setPlayers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [teamId])

  if (loading) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden">
        <div className="lg:hidden">
          <div className="sticky top-0 z-10 mb-4 space-y-3 border-b border-border bg-background/95 py-3 backdrop-blur-md">
            <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
            <div className="flex gap-2">
              <div className="h-11 w-28 shrink-0 animate-pulse rounded-xl bg-muted" />
              <div className="h-11 w-24 shrink-0 animate-pulse rounded-xl bg-muted" />
              <div className="h-11 w-32 shrink-0 animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
          <RosterMobileSkeleton count={6} />
        </div>
        <div className="hidden min-h-[40vh] items-center justify-center lg:flex">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
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
    />
  )
}
