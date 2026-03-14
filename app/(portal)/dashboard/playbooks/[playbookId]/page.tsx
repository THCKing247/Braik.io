"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Plus, ArrowLeft } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { FormationBrowseCard } from "@/components/portal/formation-browse-card"
import { PlayCard } from "@/components/portal/play-card"
import type { PlaybookRecord, FormationRecord, SubFormationRecord, PlayRecord } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"

function PlaybookDetailContent({
  playbookId,
  teamId,
  canEdit,
}: {
  playbookId: string
  teamId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [formations, setFormations] = useState<FormationRecord[]>([])
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [subFormations, setSubFormations] = useState<SubFormationRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pbRes, fRes, pRes, sfRes, dcRes] = await Promise.all([
        fetch(`/api/playbooks/${playbookId}`),
        fetch(`/api/formations?teamId=${teamId}&playbookId=${playbookId}`),
        fetch(`/api/plays?teamId=${teamId}&playbookId=${playbookId}`),
        fetch(`/api/sub-formations?teamId=${teamId}`),
        fetch(`/api/roster/depth-chart?teamId=${teamId}`),
      ])
      if (pbRes.ok) setPlaybook(await pbRes.json())
      if (fRes.ok) setFormations(await fRes.json())
      if (pRes.ok) setPlays(await pRes.json())
      if (sfRes.ok) setSubFormations(await sfRes.json())
      if (dcRes.ok) {
        const dc = await dcRes.json()
        setDepthChartEntries(dc.entries ?? [])
      }
    } catch (e) {
      console.error("Failed to load playbook detail", e)
    } finally {
      setLoading(false)
    }
  }, [playbookId, teamId])

  useEffect(() => {
    load()
  }, [load])

  const formationPlayCount = (formationId: string) => plays.filter((p) => p.formationId === formationId).length
  const formationSubCount = (formationId: string) => subFormations.filter((s) => s.formationId === formationId).length

  const topLevelPlays = plays.filter((p) => !p.formationId)

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: playbook?.name ?? "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
  ]

  const playEditorPath = (playId: string) => `/dashboard/playbooks/${playbookId}/play/${playId}/edit`
  const handleDuplicatePlay = async (playId: string) => {
    const play = plays.find((p) => p.id === playId)
    if (!play) return
    try {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          side: play.side,
          formation: play.formation,
          formationId: play.formationId ?? undefined,
          subFormationId: play.subFormationId ?? undefined,
          playbookId: playbookId ?? undefined,
          name: `${play.name} (copy)`,
          playType: play.playType ?? undefined,
          canvasData: play.canvasData,
        }),
      })
      if (res.ok) load()
    } catch {
      alert("Failed to duplicate play")
    }
  }
  const handleRenamePlay = async (playId: string, newName: string) => {
    try {
      const res = await fetch(`/api/plays/${playId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) load()
    } catch {
      alert("Failed to rename play")
    }
  }
  const handleDeletePlay = async (playId: string) => {
    try {
      const res = await fetch(`/api/plays/${playId}`, { method: "DELETE" })
      if (res.ok) load()
    } catch {
      alert("Failed to delete play")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }
  if (!playbook) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-sm text-slate-500">Playbook not found</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/playbooks")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Playbooks
        </Button>
      </div>
    )
  }
  return (
    <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
              <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{playbook.name}</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Formations and top-level plays. Open a formation to manage sub-formations and plays.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/playbooks")}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  {canEdit && (
                    <>
                      <Button size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/edit`)}>
                        Edit playbook
                      </Button>
                      <Button size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/new`)}>
                        <Plus className="h-4 w-4 mr-1" /> New formation
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/play/new`)}>
                        <Plus className="h-4 w-4 mr-1" /> New play
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50 space-y-8">
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Formations</h2>
                {formations.length === 0 ? (
                  <div className="py-8 text-center rounded-xl border border-dashed border-slate-200 bg-white/60">
                    <p className="text-slate-600 font-medium">No formations yet</p>
                    <p className="text-sm text-slate-500 mt-1">Add a formation to organize sub-formations and plays.</p>
                    {canEdit && (
                      <Button size="sm" className="mt-4" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/new`)}>
                        <Plus className="h-4 w-4 mr-1" /> New formation
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {formations.map((f) => (
                      <FormationBrowseCard
                        key={f.id}
                        formation={f}
                        subformationCount={formationSubCount(f.id)}
                        playCount={formationPlayCount(f.id)}
                        onSelect={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${f.id}`)}
                        canEdit={canEdit}
                      />
                    ))}
                  </div>
                )}
              </section>

              {topLevelPlays.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Plays (no formation)</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {topLevelPlays.map((play) => (
                      <div key={play.id} className="min-w-[200px] w-full">
                        <PlayCard
                          play={play}
                          formations={formations}
                          depthChartEntries={depthChartEntries}
                          isSelected={false}
                          onOpen={() => router.push(playEditorPath(play.id))}
                          onDuplicate={handleDuplicatePlay}
                          onRename={handleRenamePlay}
                          onDelete={handleDeletePlay}
                          canEdit={canEdit}
                          viewMode="grid"
                          playEditorPath={playEditorPath}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
  )
}

export default function PlaybookDetailPage() {
  const params = useParams()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null

  if (!playbookId) {
    return (
      <DashboardPageShell>
        {() => (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-sm text-slate-500">Invalid playbook</p>
          </div>
        )}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <PlaybookDetailContent playbookId={playbookId} teamId={teamId} canEdit={canEdit} />
      )}
    </DashboardPageShell>
  )
}
