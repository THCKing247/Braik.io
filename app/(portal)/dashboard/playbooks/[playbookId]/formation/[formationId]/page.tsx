"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Plus, ArrowLeft } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { FormationThumbnail } from "@/components/portal/formation-thumbnail"
import { PlayCard } from "@/components/portal/play-card"
import { Card, CardContent } from "@/components/ui/card"
import type { FormationRecord, SubFormationRecord, PlayRecord } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"

function FormationDetailContent({
  playbookId,
  formationId,
  teamId,
  canEdit,
}: {
  playbookId: string
  formationId: string
  teamId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [formation, setFormation] = useState<FormationRecord | null>(null)
  const [subFormations, setSubFormations] = useState<SubFormationRecord[]>([])
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, sfRes, pRes, dcRes] = await Promise.all([
        fetch(`/api/formations/${formationId}`),
        fetch(`/api/sub-formations?teamId=${teamId}&formationId=${formationId}`),
        fetch(`/api/plays?teamId=${teamId}&formationId=${formationId}`),
        fetch(`/api/roster/depth-chart?teamId=${teamId}`),
      ])
      if (fRes.ok) setFormation(await fRes.json())
      if (sfRes.ok) setSubFormations(await sfRes.json())
      if (pRes.ok) setPlays(await pRes.json())
      if (dcRes.ok) {
        const dc = await dcRes.json()
        setDepthChartEntries(dc.entries ?? [])
      }
    } catch (e) {
      console.error("Failed to load formation detail", e)
    } finally {
      setLoading(false)
    }
  }, [formationId, teamId])

  useEffect(() => {
    load()
  }, [load])

  const playsForSubFormation = (subId: string | null) =>
    subId ? plays.filter((p) => p.subFormationId === subId) : plays.filter((p) => !p.subFormationId)

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
          formationId: formation?.id,
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

  const playEditorPath = (playId: string) => `/dashboard/playbooks/${playbookId}/formation/${formationId}/play/${playId}/edit`

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }
  if (!formation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-sm text-slate-500">Formation not found</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
    )
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: "Playbook", href: `/dashboard/playbooks/${playbookId}` },
    { label: formation.name, href: `/dashboard/playbooks/${playbookId}/formation/${formationId}` },
  ]

  return (
    <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
        <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{formation.name}</h1>
            <p className="mt-1 text-sm text-slate-600">Sub-formations and plays in this formation.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {canEdit && (
              <>
                <Button size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/edit`)}>
                  Edit formation
                </Button>
                <Button size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/new`)}>
                  <Plus className="h-4 w-4 mr-1" /> New sub-formation
                </Button>
                <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/play/new`)}>
                  <Plus className="h-4 w-4 mr-1" /> New play
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50 space-y-8">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Sub-formations</h2>
          {subFormations.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-slate-200 bg-white/60">
              <p className="text-slate-600 font-medium">No sub-formations yet</p>
              <p className="text-sm text-slate-500 mt-1">Add a sub-formation or add plays directly.</p>
              {canEdit && (
                <Button size="sm" className="mt-4" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/new`)}>
                  <Plus className="h-4 w-4 mr-1" /> New sub-formation
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {subFormations.map((sf) => (
                <Card
                  key={sf.id}
                  className="min-w-[200px] cursor-pointer overflow-hidden border-2 border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all p-0"
                  onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${sf.id}`)}
                >
                  <FormationThumbnail templateData={sf.templateData ?? formation.templateData} side={formation.side} className="rounded-t-lg" />
                  <CardContent className="p-4">
                    <span className="font-bold text-slate-800 block truncate">{sf.name}</span>
                    <span className="text-sm text-slate-500">{playsForSubFormation(sf.id).length} plays</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Plays (this formation)</h2>
          {plays.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-slate-200 bg-white/60">
              <p className="text-slate-600 font-medium">No plays yet</p>
              {canEdit && (
                <Button size="sm" className="mt-4" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/play/new`)}>
                  <Plus className="h-4 w-4 mr-1" /> New play
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {plays.map((play) => (
                <div key={play.id} className="min-w-[200px] w-full">
                  <PlayCard
                    play={play}
                    formations={[formation]}
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
          )}
        </section>
      </div>
    </div>
  )
}

export default function FormationDetailPage() {
  const params = useParams()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null

  if (!playbookId || !formationId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid route</p>}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <FormationDetailContent playbookId={playbookId} formationId={formationId} teamId={teamId} canEdit={canEdit} />
      )}
    </DashboardPageShell>
  )
}
