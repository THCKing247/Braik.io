"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpCircle, Loader2 } from "lucide-react"

interface Suggestion {
  playerId: string
  playerName: string
  currentLevel: string
  practiceGrade: string | null
  playbookMastery: string | null
  recentStatsSummary: string | null
  reason: string
}

const POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K", "P"]

interface CallUpSuggestionsPanelProps {
  programId: string
  /** Optional: pre-select this position (e.g. from depth chart slot) */
  defaultPosition?: string
}

export function CallUpSuggestionsPanel({ programId, defaultPosition = "QB" }: CallUpSuggestionsPanelProps) {
  const [position, setPosition] = useState(defaultPosition)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setPosition(defaultPosition)
  }, [defaultPosition])

  useEffect(() => {
    if (!programId || !position) return
    setLoading(true)
    fetch(
      `/api/programs/callup-suggestions?programId=${encodeURIComponent(programId)}&position=${encodeURIComponent(position)}`
    )
      .then((res) => (res.ok ? res.json() : { suggestions: [] }))
      .then((data: { suggestions?: Suggestion[] }) => setSuggestions(data.suggestions ?? []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false))
  }, [programId, position])

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ArrowUpCircle className="h-4 w-4" />
          Suggested Call-Ups
        </CardTitle>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Position"
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions for this position.</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div
                key={s.playerId}
                className="rounded-md border border-border bg-muted/30 p-3 text-sm"
              >
                <div className="font-medium text-foreground">{s.playerName}</div>
                <div className="mt-1 text-muted-foreground capitalize">{s.currentLevel}</div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {s.practiceGrade != null && (
                    <span>Practice: {s.practiceGrade}</span>
                  )}
                  {s.playbookMastery != null && (
                    <span>Playbook: {s.playbookMastery}</span>
                  )}
                  {s.recentStatsSummary != null && (
                    <span>{s.recentStatsSummary}</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.reason}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
