"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { PlayerStatsRow } from "@/lib/stats-helpers"

export type LeaderStat = "passingYards" | "rushingYards" | "receivingYards" | "tackles"

const LEADER_CONFIG: { key: LeaderStat; label: string }[] = [
  { key: "passingYards", label: "Passing yards" },
  { key: "rushingYards", label: "Rushing yards" },
  { key: "receivingYards", label: "Receiving yards" },
  { key: "tackles", label: "Tackles" },
]

function getLeader(
  players: PlayerStatsRow[],
  key: LeaderStat
): { player: PlayerStatsRow; value: number } | null {
  let best: { player: PlayerStatsRow; value: number } | null = null
  for (const p of players) {
    const raw = p[key]
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0
    if (value > 0 && (!best || value > best.value)) {
      best = { player: p, value }
    }
  }
  return best
}

export interface StatsLeaderCardsProps {
  players: PlayerStatsRow[]
}

export function StatsLeaderCards({ players }: StatsLeaderCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {LEADER_CONFIG.map(({ key, label }) => {
        const leader = getLeader(players, key)
        return (
          <Card
            key={key}
            className="border"
            style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
          >
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                {label} leader
              </p>
              {leader ? (
                <>
                  <p className="mt-1 text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
                    {leader.player.firstName} {leader.player.lastName}
                  </p>
                  <p className="text-sm font-medium" style={{ color: "rgb(var(--accent))" }}>
                    {leader.value.toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
                  —
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
