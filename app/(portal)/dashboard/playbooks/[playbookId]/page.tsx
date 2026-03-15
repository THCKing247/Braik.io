"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Plus, ArrowLeft, Search, FileText, Calendar, Smartphone, Presentation, ListOrdered } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { FormationBrowseCard } from "@/components/portal/formation-browse-card"
import { SortablePlayList } from "@/components/portal/sortable-play-list"
import { ConfirmDestructiveDialog } from "@/components/portal/confirm-destructive-dialog"
import type { PlaybookRecord, FormationRecord, SubFormationRecord, PlayRecord } from "@/types/playbook"
import { filterPlaysBySearch, filterPlaysByTags } from "@/lib/utils/play-search"
import { PlayTagFilter } from "@/components/portal/play-tag-filter"
import { Input } from "@/components/ui/input"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import { CommentThreadPanel } from "@/components/portal/comment-thread-panel"
import { CoachBSuggestPanel } from "@/components/portal/coach-b-suggest-panel"

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
  const { showToast } = usePlaybookToast()
  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [formations, setFormations] = useState<FormationRecord[]>([])
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [subFormations, setSubFormations] = useState<SubFormationRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [playSearchQuery, setPlaySearchQuery] = useState("")
  const [tagFilterSelected, setTagFilterSelected] = useState<string[]>([])
  const [formationToDeleteId, setFormationToDeleteId] = useState<string | null>(null)
  const [formationDeleteImpact, setFormationDeleteImpact] = useState<{
    subFormationsCount: number
    directPlaysCount: number
    subFormationPlaysCount: number
    totalPlaysCount: number
  } | null>(null)
  const [formationDeleteImpactLoading, setFormationDeleteImpactLoading] = useState(false)
  const [formationDeleting, setFormationDeleting] = useState(false)

  useEffect(() => {
    if (!formationToDeleteId) {
      setFormationDeleteImpact(null)
      return
    }
    setFormationDeleteImpactLoading(true)
    fetch(`/api/formations/${formationToDeleteId}/delete-impact`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setFormationDeleteImpact(data)
      })
      .catch(() => setFormationDeleteImpact(null))
      .finally(() => setFormationDeleteImpactLoading(false))
  }, [formationToDeleteId])

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
      if (pRes.ok) {
        setPlays(await pRes.json())
      } else {
        setPlays([])
        showToast("Could not load plays", "error")
      }
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
  }, [playbookId, teamId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const formationPlayCount = (formationId: string) => plays.filter((p) => p.formationId === formationId).length
  const formationSubCount = (formationId: string) => subFormations.filter((s) => s.formationId === formationId).length

  const handleDuplicateFormation = useCallback(
    async (formationId: string) => {
      try {
        const res = await fetch(`/api/formations/${formationId}/duplicate`, { method: "POST" })
        if (!res.ok) throw new Error("Failed to duplicate")
        const formation = await res.json()
        showToast("Formation duplicated", "success")
        router.push(`/dashboard/playbooks/${playbookId}/formation/${formation.id}/edit`)
      } catch {
        showToast("Failed to duplicate formation", "error")
      }
    },
    [playbookId, router, showToast]
  )

  const handleConfirmDeleteFormation = useCallback(async () => {
    if (!formationToDeleteId) return
    setFormationDeleting(true)
    try {
      const res = await fetch(`/api/formations/${formationToDeleteId}`, { method: "DELETE" })
      if (res.ok) {
        showToast("Formation deleted", "success")
        setFormationToDeleteId(null)
        router.push(`/dashboard/playbooks/${playbookId}`)
      } else {
        showToast("Could not delete formation", "error")
      }
    } catch {
      showToast("Could not delete formation", "error")
    } finally {
      setFormationDeleting(false)
    }
  }, [formationToDeleteId, playbookId, router, showToast, load])

  const topLevelPlays = plays.filter((p) => !p.formationId)
  const filteredTopLevelPlays = filterPlaysBySearch(
    filterPlaysByTags(topLevelPlays, tagFilterSelected),
    playSearchQuery
  )

  const handleReorderTopLevelPlays = useCallback((reordered: PlayRecord[]) => {
    setPlays((prev) => [...reordered, ...prev.filter((p) => p.formationId)])
  }, [])

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: playbook?.name ?? "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
  ]

  const playEditorPath = (playId: string) => `/dashboard/playbooks/${playbookId}/play/${playId}/edit`
  const handleDuplicatePlay = useCallback(
    async (playId: string) => {
      try {
        const res = await fetch(`/api/plays/${playId}/duplicate`, { method: "POST" })
        if (!res.ok) throw new Error("Failed to duplicate")
        const newPlay = await res.json()
        showToast("Play duplicated", "success")
        const returnUrl = `/dashboard/playbooks/${playbookId}`
        router.push(`/dashboard/playbooks/play/${newPlay.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
      } catch {
        showToast("Could not duplicate play", "error")
      }
    },
    [playbookId, router, showToast]
  )
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
      if (res.ok) {
        showToast("Play deleted", "success")
        load()
      } else {
        showToast("Could not delete play", "error")
      }
    } catch {
      showToast("Could not delete play", "error")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="h-4 w-48 bg-slate-200 rounded animate-pulse mb-3" />
          <div className="h-7 w-64 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-full max-w-md bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-5 sm:p-6 bg-slate-50 space-y-8">
          <section>
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 h-40 animate-pulse">
                  <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 rounded w-1/3 mt-2" />
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </section>
        </div>
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
                  <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/call-sheet`)}>
                    <FileText className="h-4 w-4 mr-1" /> Call sheet
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/scripts`)}>
                    <Calendar className="h-4 w-4 mr-1" /> Practice scripts
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/install-scripts`)}>
                    <ListOrdered className="h-4 w-4 mr-1" /> Install scripts
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/game-day`)}>
                    <Smartphone className="h-4 w-4 mr-1" /> Game day
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/present`)}>
                    <Presentation className="h-4 w-4 mr-1" /> Presenter
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
                        onEdit={canEdit ? () => router.push(`/dashboard/playbooks/${playbookId}/formation/${f.id}/edit`) : undefined}
                        onDuplicate={canEdit ? () => handleDuplicateFormation(f.id) : undefined}
                        onDelete={canEdit ? () => setFormationToDeleteId(f.id) : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>

              {topLevelPlays.length > 0 && (
                <section>
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Plays (no formation)</h2>
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="search"
                          placeholder="Search plays..."
                          value={playSearchQuery}
                          onChange={(e) => setPlaySearchQuery(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>
                    <PlayTagFilter selectedTags={tagFilterSelected} onChange={setTagFilterSelected} />
                  </div>
                  <SortablePlayList
                    plays={filteredTopLevelPlays}
                    formations={formations}
                    depthChartEntries={depthChartEntries}
                    canEdit={canEdit && !playSearchQuery.trim()}
                    playEditorPath={playEditorPath}
                    onDuplicate={handleDuplicatePlay}
                    onRename={handleRenamePlay}
                    onDelete={handleDeletePlay}
                    onReorder={handleReorderTopLevelPlays}
                    reorderScopeKey={playbookId}
                  />
                </section>
              )}
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Coach B</h2>
                <CoachBSuggestPanel
                  teamId={teamId}
                  playbookId={playbookId}
                  returnUrl={`/dashboard/playbooks/${playbookId}`}
                  className="max-w-xl"
                />
              </section>
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Collaboration</h2>
                <CommentThreadPanel parentType="playbook" parentId={playbookId} defaultCollapsed={true} />
              </section>
            </div>
            <ConfirmDestructiveDialog
              open={!!formationToDeleteId}
              onOpenChange={(open) => !open && setFormationToDeleteId(null)}
              title="Delete this formation?"
              message="This will also permanently delete all sub-formations and all plays under this formation, including plays inside its sub-formations. This action cannot be undone."
              impactItems={formationDeleteImpact ? [
                { label: "Sub-formations to delete", value: formationDeleteImpact.subFormationsCount },
                { label: "Direct plays to delete", value: formationDeleteImpact.directPlaysCount },
                { label: "Sub-formation plays to delete", value: formationDeleteImpact.subFormationPlaysCount },
                { label: "Total plays to delete", value: formationDeleteImpact.totalPlaysCount },
              ] : undefined}
              isLoadingImpact={formationDeleteImpactLoading}
              confirmLabel="Delete"
              cancelLabel="Cancel"
              onConfirm={handleConfirmDeleteFormation}
              isDeleting={formationDeleting}
            />
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
