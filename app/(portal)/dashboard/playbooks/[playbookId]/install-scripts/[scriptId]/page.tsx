"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Plus, ChevronUp, ChevronDown, Presentation } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CompactPlayCard } from "@/components/portal/compact-play-card"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import type { PlaybookRecord, PlayRecord } from "@/types/playbook"

type InstallScriptItem = { id: string; scriptId: string; playId: string; orderIndex: number }

type InstallScript = {
  id: string
  playbookId: string
  teamId: string
  name: string
  createdAt: string
  items: InstallScriptItem[]
}

export default function InstallScriptBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const scriptId = typeof params?.scriptId === "string" ? params.scriptId : null
  const { showToast } = usePlaybookToast()

  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [script, setScript] = useState<InstallScript | null>(null)
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddPlay, setShowAddPlay] = useState(false)

  const load = useCallback(async () => {
    if (!playbookId || !scriptId) return
    setLoading(true)
    try {
      const [pbRes, sRes] = await Promise.all([
        fetch(`/api/playbooks/${playbookId}`),
        fetch(`/api/install-scripts/${scriptId}`),
      ])
      const pb = pbRes.ok ? await pbRes.json() : null
      const scr = sRes.ok ? await sRes.json() : null
      if (pb) setPlaybook(pb)
      if (scr) setScript(scr)
      const teamId = scr?.teamId ?? pb?.team_id ?? pb?.teamId
      if (teamId && playbookId) {
        const pRes = await fetch(`/api/plays?teamId=${teamId}&playbookId=${playbookId}`)
        if (pRes.ok) {
          const data = await pRes.json()
          setPlays(Array.isArray(data) ? data : data.plays ?? [])
        }
      }
    } catch (e) {
      console.error("Failed to load install script", e)
      showToast("Failed to load install script", "error")
    } finally {
      setLoading(false)
    }
  }, [playbookId, scriptId, showToast])

  useEffect(() => {
    load()
  }, [load])


  const saveName = useCallback(
    async (name: string) => {
      if (!scriptId || saving || !name.trim()) return
      setSaving(true)
      try {
        const res = await fetch(`/api/install-scripts/${scriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
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

  const saveItems = useCallback(
    async (items: { playId: string }[]) => {
      if (!scriptId || saving) return
      setSaving(true)
      try {
        const res = await fetch(`/api/install-scripts/${scriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
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

  const addPlay = useCallback(
    (playId: string) => {
      if (!script) return
      const currentIds = script.items.map((i) => i.playId)
      if (currentIds.includes(playId)) return
      saveItems([...currentIds, playId].map((id) => ({ playId: id })))
      setShowAddPlay(false)
    },
    [script, saveItems]
  )

  const removePlay = useCallback(
    (playId: string) => {
      if (!script) return
      saveItems(
        script.items
          .map((i) => i.playId)
          .filter((id) => id !== playId)
          .map((id) => ({ playId: id }))
      )
    },
    [script, saveItems]
  )

  const movePlay = useCallback(
    (index: number, dir: -1 | 1) => {
      if (!script) return
      const order = script.items.map((i) => i.playId)
      const next = index + dir
      if (next < 0 || next >= order.length) return
      ;[order[index], order[next]] = [order[next], order[index]]
      saveItems(order.map((id) => ({ playId: id })))
    },
    [script, saveItems]
  )

  const playById = (id: string) => plays.find((p) => p.id === id)
  const scriptPlayIds = script?.items.map((i) => i.playId) ?? []
  const playsNotInScript = plays.filter((p) => !scriptPlayIds.includes(p.id))

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: playbook?.name ?? "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: "Install scripts", href: playbookId ? `/dashboard/playbooks/${playbookId}/install-scripts` : undefined },
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
              <Input
                value={script.name}
                onChange={(e) => setScript((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                onBlur={(e) => saveName(e.target.value)}
                className="text-xl font-semibold max-w-md h-10 border-0 border-b border-transparent hover:border-slate-200 focus:border-slate-400 focus:ring-0 px-0"
                placeholder="Script name"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/install-scripts`)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push(`/dashboard/playbooks/${playbookId}/present?scriptId=${scriptId}`)}
                  disabled={script.items.length === 0}
                  title={script.items.length === 0 ? "Add at least one play to present" : "Open presenter with this script order"}
                >
                  <Presentation className="h-4 w-4 mr-1" /> Present
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Plays in order</h2>
              {script.items.length === 0 ? (
                <div className="py-8 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                  <p className="text-slate-600 font-medium">No plays in this script</p>
                  <p className="text-sm text-slate-500 mt-1">Add plays below; order defines presenter navigation.</p>
                  {!showAddPlay && (
                    <Button size="sm" className="mt-4" onClick={() => setShowAddPlay(true)} disabled={saving}>
                      <Plus className="h-4 w-4 mr-1" /> Add play
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="space-y-2">
                  {script.items.map((item, index) => {
                    const play = playById(item.playId)
                    if (!play) return null
                    return (
                      <li key={item.id} className="flex items-center gap-2">
                        <div className="flex flex-col gap-0">
                          <button
                            type="button"
                            onClick={() => movePlay(index, -1)}
                            disabled={index === 0 || saving}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePlay(index, 1)}
                            disabled={index === script.items.length - 1 || saving}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0 w-[280px]">
                          <CompactPlayCard
                            play={play}
                            onRemove={saving ? undefined : () => removePlay(play.id)}
                            size="sm"
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {showAddPlay && (
                <div className="mt-4 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-600 mb-2">Add play</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {playsNotInScript.length === 0 ? (
                      <p className="text-xs text-slate-500">All plays added</p>
                    ) : (
                      playsNotInScript.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addPlay(p.id)}
                          className="block w-full text-left px-2 py-1.5 rounded text-sm text-slate-700 hover:bg-white"
                        >
                          {p.name}
                        </button>
                      ))
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setShowAddPlay(false)}>
                    Cancel
                  </Button>
                </div>
              )}

              {!showAddPlay && script.items.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowAddPlay(true)}
                  disabled={saving}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add play
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}
