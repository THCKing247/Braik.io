"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Plus, Printer } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { CompactPlayCard } from "@/components/portal/compact-play-card"
import type { PlaybookRecord, PlayRecord } from "@/types/playbook"
import type { CallSheetConfig, CallSheetSection } from "@/lib/constants/call-sheet-sections"
import { usePlaybookToast } from "@/components/portal/playbook-toast"

export default function CallSheetPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const { showToast } = usePlaybookToast()

  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [config, setConfig] = useState<CallSheetConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addPlaySectionId, setAddPlaySectionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!playbookId) return
    setLoading(true)
    try {
      const [pbRes, pRes, csRes] = await Promise.all([
        fetch(`/api/playbooks/${playbookId}`),
        fetch(`/api/plays?playbookId=${playbookId}`),
        fetch(`/api/playbooks/${playbookId}/call-sheet`),
      ])
      if (pbRes.ok) setPlaybook(await pbRes.json())
      if (pRes.ok) {
        const data = await pRes.json()
        setPlays(Array.isArray(data) ? data : data.plays ?? [])
      }
      if (csRes.ok) setConfig(await csRes.json())
    } catch (e) {
      console.error("Failed to load call sheet", e)
      showToast("Failed to load call sheet", "error")
    } finally {
      setLoading(false)
    }
  }, [playbookId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const saveConfig = useCallback(
    async (newConfig: CallSheetConfig) => {
      if (!playbookId || saving) return
      setSaving(true)
      try {
        const res = await fetch(`/api/playbooks/${playbookId}/call-sheet`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: newConfig }),
        })
        if (res.ok) {
          setConfig(newConfig)
          showToast("Call sheet saved", "success")
        } else {
          showToast("Failed to save call sheet", "error")
        }
      } catch {
        showToast("Failed to save call sheet", "error")
      } finally {
        setSaving(false)
      }
    },
    [playbookId, saving, showToast]
  )

  const addPlayToSection = useCallback(
    (sectionId: string, playId: string) => {
      if (!config) return
      const sections = config.sections.map((s) =>
        s.id === sectionId ? { ...s, playIds: [...s.playIds, playId] } : s
      )
      saveConfig({ sections })
      setAddPlaySectionId(null)
    },
    [config, saveConfig]
  )

  const removePlayFromSection = useCallback(
    (sectionId: string, playId: string) => {
      if (!config) return
      const sections = config.sections.map((s) =>
        s.id === sectionId ? { ...s, playIds: s.playIds.filter((id) => id !== playId) } : s
      )
      saveConfig({ sections })
    },
    [config, saveConfig]
  )

  const playById = (id: string) => plays.find((p) => p.id === id)

  const handlePrint = () => {
    window.print()
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: playbook?.name ?? "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: "Call sheet" },
  ]

  if (!playbookId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid playbook</p>}
      </DashboardPageShell>
    )
  }

  if (loading || !config) {
    return (
      <DashboardPageShell>
        {() => (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-sm text-slate-500">Loading call sheet...</p>
          </div>
        )}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {() => (
        <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5 print:border-b-0">
            <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Call sheet</h1>
                <p className="mt-1 text-sm text-slate-600">Group plays by down and situation. Print for the sideline.</p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50 print:bg-white print:p-4">
            <div className="space-y-8 print:space-y-6">
              {config.sections.map((section) => (
                <section key={section.id} className="break-inside-avoid">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3 print:text-slate-800">
                    {section.label}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {section.playIds.map((playId) => {
                      const play = playById(playId)
                      if (!play) return null
                      return (
                        <div key={playId} className="w-full sm:w-[280px] print:w-[calc(50%-0.5rem)] print:inline-block print:align-top">
                          <CompactPlayCard
                            play={play}
                            onRemove={saving ? undefined : () => removePlayFromSection(section.id, playId)}
                            size="md"
                          />
                        </div>
                      )
                    })}
                    <div className="print:hidden w-full sm:w-[280px]">
                      {addPlaySectionId === section.id ? (
                        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-3">
                          <p className="text-xs font-medium text-slate-600 mb-2">Add a play</p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {plays
                              .filter((p) => !section.playIds.includes(p.id))
                              .map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => addPlayToSection(section.id, p.id)}
                                  className="block w-full text-left px-2 py-1.5 rounded text-sm text-slate-700 hover:bg-slate-100"
                                >
                                  {p.name}
                                </button>
                              ))}
                            {plays.filter((p) => !section.playIds.includes(p.id)).length === 0 && (
                              <p className="text-xs text-slate-500">All plays already added</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => setAddPlaySectionId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddPlaySectionId(section.id)}
                          className="w-full rounded-lg border-2 border-dashed border-slate-200 bg-white p-4 flex items-center justify-center gap-2 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
                        >
                          <Plus className="h-4 w-4" /> Add play
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}
