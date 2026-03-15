"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface ProgramDepthChartLevelEntry {
  id: string
  unit: string
  position: string
  string: number
  playerId: string | null
  player: {
    id: string
    firstName: string
    lastName: string
    jerseyNumber: number | null
    imageUrl: string | null
  } | null
  formation: string | null
  specialTeamType: string | null
}

export interface ProgramDepthChartLevel {
  teamId: string
  teamLevel: "varsity" | "jv" | "freshman"
  teamName: string
  entries: ProgramDepthChartLevelEntry[]
}

interface ProgramDepthChartViewProps {
  programId: string
}

function levelLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

export function ProgramDepthChartView({ programId }: ProgramDepthChartViewProps) {
  const [levels, setLevels] = useState<ProgramDepthChartLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<"offense" | "defense" | "special_teams">("offense")

  useEffect(() => {
    if (!programId) return
    setLoading(true)
    setError(null)
    fetch(`/api/programs/${programId}/depth-chart`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Access denied" : "Failed to load")
        return res.json()
      })
      .then((data: { levels?: ProgramDepthChartLevel[] }) => {
        setLevels(data.levels ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [programId])

  const entriesByPosition = (entries: ProgramDepthChartLevelEntry[]) => {
    const byPos = new Map<string, ProgramDepthChartLevelEntry[]>()
    for (const e of entries) {
      if (e.unit !== selectedUnit) continue
      const list = byPos.get(e.position) ?? []
      list.push(e)
      byPos.set(e.position, list)
    }
    for (const list of byPos.values()) {
      list.sort((a, b) => a.string - b.string)
    }
    return byPos
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-border">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    )
  }

  if (!levels.length) {
    return (
      <Card className="border-border">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No team levels (Varsity, JV, Freshman) in this program yet, or no depth chart data.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["offense", "defense", "special_teams"] as const).map((unit) => (
          <button
            key={unit}
            type="button"
            onClick={() => setSelectedUnit(unit)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              selectedUnit === unit
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {unit === "special_teams" ? "Special teams" : unit.charAt(0).toUpperCase() + unit.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {levels.map((level) => {
          const byPosition = entriesByPosition(level.entries)
          const positions = Array.from(byPosition.keys()).sort()
          if (positions.length === 0) return null
          return (
            <Card key={level.teamId} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {levelLabel(level.teamLevel)} — {level.teamName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {positions.map((position) => {
                  const list = byPosition.get(position) ?? []
                  return (
                    <div key={position} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="w-20 font-medium text-muted-foreground">{position}</span>
                      <span className="text-sm">
                        {list
                          .sort((a, b) => a.string - b.string)
                          .map((e) => {
                            const name = e.player
                              ? `${e.player.firstName} ${e.player.lastName}${e.player.jerseyNumber != null ? ` #${e.player.jerseyNumber}` : ""}`
                              : "—"
                            return (
                              <span key={e.id} className="mr-3">
                                {e.string}. {name}
                              </span>
                            )
                          })}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
