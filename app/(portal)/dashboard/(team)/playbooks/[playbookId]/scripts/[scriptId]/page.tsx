"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Plus, GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CompactPlayCard } from "@/components/portal/compact-play-card"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import type { PlaybookRecord, PlayRecord } from "@/types/playbook"

type PeriodEntry = { id: string; name: string; notes: string; playIds: string[] }

type Script = {
  id: string
  playbookId: string
  teamId: string
  name: string
  periods: PeriodEntry[]
  createdAt: string
  updatedAt: string
}

const DEFAULT_PERIOD_NAMES = ["Period 1", "Period 2", "Team", "7-on-7", "Red Zone"]

export default function PracticeScriptBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const scriptId = typeof params?.scriptId === "string" ? params.scriptId : null
  const { showToast } = usePlaybookToast()

  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [script, setScript] = useState<Script | null>(null)
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addPlayPeriodId, setAddPlayPeriodId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!playbookId || !scriptId) return
    setLoading(true)
    try {
      const [pbRes, sRes, pRes] = await Promise.all([
        fetch(`/api/playbooks/${playbookId}`),
        fetch(`/api/practice-scripts/${scriptId}`),
        fetch(`/api/plays?playbookId=${playbookId}`),
      ])
      if (pbRes.ok) setPlaybook(await pbRes.json())
      if (sRes.ok) setScript(await sRes.json())
      if (pRes.ok) {
        const data = await pRes.json()
        setPlays(Array.isArray(data) ? data : data.plays ?? [])
      }
    } catch (e) {
      console.error("Failed to load script", e)
      showToast("Failed to load script", "error")
    } finally {
      setLoading(false)
    }
  }, [playbookId, scriptId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const savePeriods = useCallback(
    async (periods: PeriodEntry[]) => {
      if (!scriptId || saving) return
      setSaving(true)
      try {
        const res = await fetch(`/api/practice-scripts/${scriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periods }),
        })
        if (res.ok) {
          const updated = await res.json()
          setScript(updated)
          showToast("Script saved", "success")
        } else {
          showToast("Failed to save script", "error")
        }
      } catch {
        showToast("Failed to save script", "error")
      } finally {
        setSaving(false)
      }
    },
    [scriptId, saving, showToast]
  )

  const addPeriod = useCallback(() => {
    if (!script) return
    const used = script.periods.map((p) => p.name)
    const nextName = DEFAULT_PERIOD_NAMES.find((n) => !used.includes(n)) ?? `Period ${script.periods.length + 1}`
    const periods = [
      ...script.periods,
      { id: crypto.randomUUID(), name: nextName, notes: "", playIds: [] },
    ]
    savePeriods(periods)
  }, [script, savePeriods])

  const removePeriod = useCallback(
    (periodId: string) => {
      if (!script) return
      savePeriods(script.periods.filter((p) => p.id !== periodId))
    },
    [script, savePeriods]
  )

  const updatePeriod = useCallback(
    (periodId: string, updates: Partial<Pick<PeriodEntry, "name" | "notes">>) => {
      if (!script) return
      const periods = script.periods.map((p) =>
        p.id === periodId ? { ...p, ...updates } : p
      )
      setScript((prev) => (prev ? { ...prev, periods } : null))
      savePeriods(periods)
    },
    [script, savePeriods]
  )

  const blurSavePeriods = useCallback(() => {
    if (script) savePeriods(script.periods)
  }, [script, savePeriods])

  const movePeriod = useCallback(
    (index: number, dir: -1 | 1) => {
      if (!script) return
      const next = index + dir
      if (next < 0 || next >= script.periods.length) return
      const arr = [...script.periods]
      ;[arr[index], arr[next]] = [arr[next], arr[index]]
      savePeriods(arr)
    },
    [script, savePeriods]
  )

  const addPlayToPeriod = useCallback(
    (periodId: string, playId: string) => {
      if (!script) return
      const periods = script.periods.map((p) =>
        p.id === periodId ? { ...p, playIds: [...p.playIds, playId] } : p
      )
      savePeriods(periods)
      setAddPlayPeriodId(null)
    },
    [script, savePeriods]
  )

  const removePlayFromPeriod = useCallback(
    (periodId: string, playId: string) => {
      if (!script) return
      const periods = script.periods.map((p) =>
        p.id === periodId ? { ...p, playIds: p.playIds.filter((id) => id !== playId) } : p
      )
      savePeriods(periods)
    },
    [script, savePeriods]
  )

  const movePlayInPeriod = useCallback(
    (periodId: string, playIndex: number, dir: -1 | 1) => {
      if (!script) return
      const period = script.periods.find((p) => p.id === periodId)
      if (!period) return
      const next = playIndex + dir
      if (next < 0 || next >= period.playIds.length) return
      const playIds = [...period.playIds]
      ;[playIds[playIndex], playIds[next]] = [playIds[next], playIds[playIndex]]
      const periods = script.periods.map((p) =>
        p.id === periodId ? { ...p, playIds } : p
      )
      savePeriods(periods)
    },
    [script, savePeriods]
  )

  const playById = (id: string) => plays.find((p) => p.id === id)

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: playbook?.name ?? "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: "Practice scripts", href: playbookId ? `/dashboard/playbooks/${playbookId}/scripts` : undefined },
    { label: script?.name ?? "Script" },
  ]

  if (!playbookId || !scriptId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid route</p>}
      </DashboardPageShell>
    )
  }

  if (loading || !script) {
    return (
      <DashboardPageShell>
        {() => (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-sm text-slate-500">Loading script...</p>
          </div>
        )}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {() => (
        <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold text-slate-900">{script.name}</h1>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/scripts`)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button size="sm" onClick={addPeriod} disabled={saving}>
                  <Plus className="h-4 w-4 mr-1" /> Add period
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50 space-y-6">
            {script.periods.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 bg-white">
                <p className="text-slate-600 font-medium">No periods yet</p>
                <p className="text-sm text-slate-500 mt-1">Add a period (e.g. Period 1, Team, 7-on-7) and add plays in order.</p>
                <Button size="sm" className="mt-4" onClick={addPeriod} disabled={saving}>
                  <Plus className="h-4 w-4 mr-1" /> Add period
                </Button>
              </div>
            ) : (
              script.periods.map((period, periodIndex) => (
                <div key={period.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex flex-col gap-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => movePeriod(periodIndex, -1)}
                        disabled={periodIndex === 0 || saving}
                        className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        aria-label="Move period up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePeriod(periodIndex, 1)}
                        disabled={periodIndex === script.periods.length - 1 || saving}
                        className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        aria-label="Move period down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <Input
                        value={period.name}
                        onChange={(e) => updatePeriod(period.id, { name: e.target.value })}
                        onBlur={blurSavePeriods}
                        className="font-medium h-9"
                        placeholder="Period name"
                      />
                      <Input
                        value={period.notes}
                        onChange={(e) => updatePeriod(period.id, { notes: e.target.value })}
                        onBlur={blurSavePeriods}
                        className="text-sm text-slate-600 h-8"
                        placeholder="Notes (optional)"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                      onClick={() => removePeriod(period.id)}
                      disabled={saving}
                      aria-label="Remove period"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {period.playIds.map((playId, playIndex) => {
                      const play = playById(playId)
                      if (!play) return null
                      return (
                        <div key={playId} className="flex items-center gap-0.5">
                          <div className="flex flex-col gap-0">
                            <button
                              type="button"
                              onClick={() => movePlayInPeriod(period.id, playIndex, -1)}
                              disabled={playIndex === 0 || saving}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                              aria-label="Move play up"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => movePlayInPeriod(period.id, playIndex, 1)}
                              disabled={playIndex === period.playIds.length - 1 || saving}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                              aria-label="Move play down"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="w-[260px]">
                            <CompactPlayCard
                              play={play}
                              onRemove={saving ? undefined : () => removePlayFromPeriod(period.id, playId)}
                              size="sm"
                            />
                          </div>
                        </div>
                      )
                    })}
                    {addPlayPeriodId === period.id ? (
                      <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-3 min-w-[200px]">
                        <p className="text-xs font-medium text-slate-600 mb-2">Add play</p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {plays
                            .filter((p) => !period.playIds.includes(p.id))
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addPlayToPeriod(period.id, p.id)}
                                className="block w-full text-left px-2 py-1.5 rounded text-sm text-slate-700 hover:bg-white"
                              >
                                {p.name}
                              </button>
                            ))}
                          {plays.filter((p) => !period.playIds.includes(p.id)).length === 0 && (
                            <p className="text-xs text-slate-500">All plays added</p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setAddPlayPeriodId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddPlayPeriodId(period.id)}
                        className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-3 flex items-center justify-center gap-2 text-slate-500 hover:border-slate-300 hover:text-slate-700 min-w-[120px]"
                      >
                        <Plus className="h-4 w-4" /> Add play
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}
