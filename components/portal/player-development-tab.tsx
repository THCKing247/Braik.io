"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { BarChart3, Loader2 } from "lucide-react"

interface DevelopmentMetric {
  id: string
  strength: number | null
  speed: number | null
  footballIQ: number | null
  leadership: number | null
  discipline: number | null
  notes: string | null
  createdAt: string
}

interface PlayerDevelopmentTabProps {
  playerId: string
  canEdit: boolean
}

const MAX_POINTS = 12

export function PlayerDevelopmentTab({ playerId, canEdit }: PlayerDevelopmentTabProps) {
  const [history, setHistory] = useState<DevelopmentMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [strength, setStrength] = useState("")
  const [speed, setSpeed] = useState("")
  const [footballIQ, setFootballIQ] = useState("")
  const [leadership, setLeadership] = useState("")
  const [discipline, setDiscipline] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/players/development-history?playerId=${encodeURIComponent(playerId)}&limit=${MAX_POINTS}`)
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data: { history?: DevelopmentMetric[] }) => {
        if (!cancelled) setHistory(data.history ?? [])
      })
      .catch(() => { if (!cancelled) setHistory([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [playerId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const s = strength.trim() ? Math.min(100, Math.max(0, parseInt(strength, 10) || 0)) : null
    const sp = speed.trim() ? Math.min(100, Math.max(0, parseInt(speed, 10) || 0)) : null
    const f = footballIQ.trim() ? Math.min(100, Math.max(0, parseInt(footballIQ, 10) || 0)) : null
    const l = leadership.trim() ? Math.min(100, Math.max(0, parseInt(leadership, 10) || 0)) : null
    const d = discipline.trim() ? Math.min(100, Math.max(0, parseInt(discipline, 10) || 0)) : null
    if (s == null && sp == null && f == null && l == null && d == null) return
    setSaving(true)
    try {
      const res = await fetch("/api/players/development", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          strength: s,
          speed: sp,
          footballIQ: f,
          leadership: l,
          discipline: d,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Failed to save")
      }
      setStrength("")
      setSpeed("")
      setFootballIQ("")
      setLeadership("")
      setDiscipline("")
      setNotes("")
      const data = await res.json()
      setHistory((prev) => [{ ...data, createdAt: data.createdAt }, ...prev].slice(0, MAX_POINTS))
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const series = [
    { key: "strength" as const, label: "Strength", color: "#3B82F6" },
    { key: "speed" as const, label: "Speed", color: "#10B981" },
    { key: "footballIQ" as const, label: "Football IQ", color: "#8B5CF6" },
    { key: "leadership" as const, label: "Leadership", color: "#F59E0B" },
  ]
  const points = history.slice().reverse()

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Development trend (last {points.length} evaluations)
            </h3>
            {points.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No development metrics logged yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[320px] h-[220px] flex items-end gap-0.5" style={{ gap: "2px" }}>
                  {points.map((p, i) => (
                    <div key={p.id} className="flex-1 flex flex-col items-center gap-0.5">
                      {series.map((s) => {
                        const v = p[s.key]
                        const h = v != null ? Math.round((v / 100) * 140) : 0
                        return (
                          <div
                            key={s.key}
                            className="w-full max-w-[24px] rounded-t transition-all"
                            style={{
                              height: `${h}px`,
                              minHeight: v != null && v > 0 ? "4px" : "0",
                              backgroundColor: s.color,
                              opacity: 0.85,
                            }}
                            title={`${s.label}: ${v ?? "—"}`}
                          />
                        )
                      })}
                      <span className="text-[10px] text-muted-foreground mt-1 truncate max-w-full">
                        {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  {series.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {canEdit && (
            <Card className="border-border">
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Log development metrics</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="dev-strength">Strength (0–100)</Label>
                    <input
                      id="dev-strength"
                      type="number"
                      min={0}
                      max={100}
                      value={strength}
                      onChange={(e) => setStrength(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dev-speed">Speed (0–100)</Label>
                    <input
                      id="dev-speed"
                      type="number"
                      min={0}
                      max={100}
                      value={speed}
                      onChange={(e) => setSpeed(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dev-iq">Football IQ (0–100)</Label>
                    <input
                      id="dev-iq"
                      type="number"
                      min={0}
                      max={100}
                      value={footballIQ}
                      onChange={(e) => setFootballIQ(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dev-leadership">Leadership (0–100)</Label>
                    <input
                      id="dev-leadership"
                      type="number"
                      min={0}
                      max={100}
                      value={leadership}
                      onChange={(e) => setLeadership(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dev-discipline">Discipline (0–100)</Label>
                    <input
                      id="dev-discipline"
                      type="number"
                      min={0}
                      max={100}
                      value={discipline}
                      onChange={(e) => setDiscipline(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-5">
                    <Label htmlFor="dev-notes">Notes</Label>
                    <input
                      id="dev-notes"
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-5">
                    <Button type="submit" disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      <span className="ml-2">{saving ? "Saving…" : "Save metrics"}</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
