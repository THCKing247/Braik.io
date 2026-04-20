"use client"

import { useState, useEffect } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { InvoicePageClient } from "@/components/portal/invoice-page-client"
import { LoadingState } from "@/components/ui/loading-state"

export default function InvoicePage() {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, userId }) => (
        <InvoicePageWithData
          teamId={teamId}
          userRole={userRole}
          userId={userId}
        />
      )}
    </DashboardPageShell>
  )
}

function InvoicePageWithData({
  teamId,
  userRole,
  userId,
}: {
  teamId: string
  userRole: string
  userId: string
}) {
  const [team, setTeam] = useState({
    id: teamId,
    name: "",
    amountPaid: 0,
    subscriptionPaid: false,
    teamIdCode: "",
    duesAmount: 0,
  })
  const [players, setPlayers] = useState<any[]>([])
  const [membership, setMembership] = useState<any>(null)
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) {
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async () => {
      try {
        const [codesRes, rosterRes] = await Promise.all([
          fetch(`/api/roster/codes?teamId=${encodeURIComponent(teamId)}`),
          fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}`),
        ])

        if (cancelled) return

        const codesData = codesRes.ok ? await codesRes.json() : {}
        setTeam((prev) => ({
          ...prev,
          id: teamId,
          name: codesData.teamName || prev.name,
          teamIdCode: codesData.teamIdCode || "",
        }))

        if (rosterRes.ok) {
          const rosterData = await rosterRes.json()
          setPlayers(Array.isArray(rosterData.players) ? rosterData.players : [])
        }
      } catch (_) {
        if (!cancelled) setTeam((prev) => ({ ...prev, id: teamId }))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [teamId])

  if (loading) {
    return <LoadingState label="Loading invoices" minHeightClassName="min-h-[40vh]" size="lg" />
  }

  return (
    <InvoicePageClient
      team={team}
      players={players}
      membership={membership}
      collections={collections}
      currentUserId={userId}
      userRole={userRole}
    />
  )
}
