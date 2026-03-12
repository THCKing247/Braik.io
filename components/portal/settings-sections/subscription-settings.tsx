"use client"

import { useState, useEffect } from "react"
import { SubscriptionManager } from "@/components/portal/subscription-manager"
import { Card, CardContent } from "@/components/ui/card"

interface SubscriptionSettingsProps {
  teamId: string
}

export function SubscriptionSettings({ teamId }: SubscriptionSettingsProps) {
  const [team, setTeam] = useState({
    id: teamId,
    name: "",
    amountPaid: 0,
    subscriptionPaid: false,
    subscriptionAmount: 0,
    teamIdCode: "",
  })
  const [players, setPlayers] = useState<any[]>([])
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
          subscriptionAmount: 0, // Will be calculated from player count
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
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  const playerCount = players.length
  const subscriptionAmount = playerCount * 5.0
  const remainingBalance = subscriptionAmount - (team.amountPaid || 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>
          Subscription Status
        </h2>
        <p className="text-sm mt-1" style={{ color: "rgb(var(--muted))" }}>
          View and manage your team subscription
        </p>
      </div>

      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardContent className="p-6">
          <SubscriptionManager
            team={team}
            playerCount={playerCount}
            subscriptionAmount={subscriptionAmount}
            amountPaid={team.amountPaid || 0}
            remainingBalance={remainingBalance}
            subscriptionPaid={team.subscriptionPaid || false}
            isHeadCoach={true}
            teamIdCode={team.teamIdCode || ""}
          />
        </CardContent>
      </Card>
    </div>
  )
}
