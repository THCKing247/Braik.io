"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, Loader2 } from "lucide-react"

interface MasteryRow {
  playerId: string
  playerName: string
  teamLevel: string | null
  completedCount: number
  viewedCount: number
  totalAssigned: number
  masteryPct: number
}

interface PlaybookMasterySectionProps {
  teamId: string
  canEdit: boolean
}

export function PlaybookMasterySection({ teamId, canEdit }: PlaybookMasterySectionProps) {
  const [programId, setProgramId] = useState<string | null>(null)
  const [players, setPlayers] = useState<MasteryRow[]>([])
  const [loading, setLoading] = useState(true)
  /** Avoid hammering a stale or removed program id (repeated 404s in Network tab). */
  const masteryNotFoundPrograms = useRef(new Set<string>())

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    fetch(`/api/teams/${teamId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((team: { programId?: string } | null) => {
        if (team?.programId) {
          setProgramId(team.programId)
          if (masteryNotFoundPrograms.current.has(team.programId)) {
            return Promise.resolve(null)
          }
          return fetch(`/api/programs/${team.programId}/playbook-mastery`)
        }
        setProgramId(null)
        return Promise.resolve(null)
      })
      .then((res) => {
        if (res && !res.ok && res.status === 404) {
          try {
            const u = new URL(res.url)
            const parts = u.pathname.split("/").filter(Boolean)
            const idx = parts.indexOf("programs")
            const pid = idx >= 0 ? parts[idx + 1] : null
            if (pid) masteryNotFoundPrograms.current.add(pid)
          } catch {
            /* ignore */
          }
          return { players: [] }
        }
        return res?.ok ? res.json() : { players: [] }
      })
      .then((data: { players?: MasteryRow[] }) => setPlayers(data.players ?? []))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false))
  }, [teamId])

  if (!canEdit) return null
  if (!programId && !loading) return null

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
        <BookOpen className="h-4 w-4" />
        Playbook Mastery
      </h2>
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : players.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No players or no play assignments in this program yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Player</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Level</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Completed</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Viewed</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Mastery %</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((row) => (
                    <tr key={row.playerId} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{row.playerName}</td>
                      <td className="px-4 py-2.5 text-slate-600 capitalize">{row.teamLevel ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{row.completedCount}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{row.viewedCount}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900">{row.masteryPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
