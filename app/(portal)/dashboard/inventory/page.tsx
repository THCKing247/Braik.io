"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

const InventoryManager = dynamic(
  () => import("@/components/portal/inventory-manager").then((m) => m.InventoryManager),
  { loading: () => <div className="min-h-[45vh] w-full animate-pulse rounded-xl bg-muted" aria-hidden /> }
)

const defaultCoachPermissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canAssign: true,
  canViewAll: true,
  scopedPlayerIds: null as string[] | null,
}

export default function InventoryPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => (
        <InventoryPageContent teamId={teamId} />
      )}
    </DashboardPageShell>
  )
}

function InventoryPageContent({ teamId }: { teamId: string }) {
  const [items, setItems] = useState<Array<{
    id: string
    category: string
    name: string
    quantityTotal: number
    quantityAvailable: number
    condition: string
    assignedToPlayerId?: string | null
    notes?: string | null
    status: string
    assignedPlayer?: { id: string; firstName: string; lastName: string; jerseyNumber?: number | null } | null
  }>>([])
  const [players, setPlayers] = useState<Array<{ id: string; firstName: string; lastName: string; jerseyNumber?: number | null }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/teams/${teamId}/inventory`)
      .then((res) => {
        if (!res.ok) return { items: [], players: [] }
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setItems(Array.isArray(data?.items) ? data.items : [])
          setPlayers(Array.isArray(data?.players) ? data.players : [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          setPlayers([])
        }
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
    <InventoryManager
      teamId={teamId}
      initialItems={items}
      players={players}
      permissions={defaultCoachPermissions}
    />
  )
}
