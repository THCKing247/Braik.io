"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { RosterManagerEnhanced } from "@/components/portal/roster-manager-enhanced"

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
    user: { email: string } | null
    guardianLinks: Array<{ guardian: { user: { email: string } } }>
  }
  const [players, setPlayers] = useState<PlayerItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          setPlayers(
            (data as Record<string, unknown>[]).map((p) => ({
              ...p,
              guardianLinks: Array.isArray(p.guardianLinks) ? p.guardianLinks : [],
            })) as PlayerItem[]
          )
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  return (
    <RosterManagerEnhanced
      teamId={teamId}
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
