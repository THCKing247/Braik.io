"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Plus, ArrowLeft, Copy, Search, Trash2 } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { ConfirmDestructiveDialog } from "@/components/portal/confirm-destructive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { filterPlaysBySearch, filterPlaysByTags } from "@/lib/utils/play-search"
import { PlayTagFilter } from "@/components/portal/play-tag-filter"
import { SortablePlayList } from "@/components/portal/sortable-play-list"
import type { FormationRecord, SubFormationRecord, PlayRecord } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import { CommentThreadPanel } from "@/components/portal/comment-thread-panel"
import { FormationIntelligencePanel } from "@/components/portal/formation-intelligence-panel"
import { FormationPreview } from "@/components/portal/formation-preview"
import type { RecommendedConcept } from "@/lib/constants/formation-concept-recommendations"
import { generatePlayFromConcept } from "@/lib/play-generation/generate-play-from-concept"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { CoachBAssistedPanel } from "@/components/portal/coach-b-assisted-panel"
import type { PlaySuggestion } from "@/lib/types/coach-b"

function SubFormationDetailContent({
  playbookId,
  formationId,
  subFormationId,
  teamId,
  canEdit,
}: {
  playbookId: string
  formationId: string
  subFormationId: string
  teamId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const { showToast } = usePlaybookToast()
  const [formation, setFormation] = useState<FormationRecord | null>(null)
  const [subFormation, setSubFormation] = useState<SubFormationRecord | null>(null)
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [playSearchQuery, setPlaySearchQuery] = useState("")
  const [tagFilterSelected, setTagFilterSelected] = useState<string[]>([])
  const [duplicating, setDuplicating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteImpact, setDeleteImpact] = useState<{ playsCount: number } | null>(null)
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewConceptHover, setPreviewConceptHover] = useState<RecommendedConcept | null>(null)
  const [previewConceptSelected, setPreviewConceptSelected] = useState<RecommendedConcept | null>(null)

  useEffect(() => {
    if (!deleteDialogOpen) return
    setDeleteImpactLoading(true)
    fetch(`/api/sub-formations/${subFormationId}/delete-impact`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDeleteImpact)
      .catch(() => setDeleteImpact(null))
      .finally(() => setDeleteImpactLoading(false))
  }, [deleteDialogOpen, subFormationId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, sfRes, pRes, dcRes] = await Promise.all([
        fetch(`/api/formations/${formationId}`),
        fetch(`/api/sub-formations/${subFormationId}`).catch(() => null),
        fetch(`/api/plays?teamId=${teamId}&formationId=${formationId}&subFormationId=${subFormationId}`),
        fetch(`/api/roster/depth-chart?teamId=${teamId}`),
      ])
      if (fRes?.ok) setFormation(await fRes.json())
      if (sfRes?.ok) {
        const data = await sfRes.json()
        setSubFormation(data)
      } else {
        const listRes = await fetch(`/api/sub-formations?teamId=${teamId}&formationId=${formationId}`)
        if (listRes.ok) {
          const list = await listRes.json()
          const found = list.find((s: SubFormationRecord) => s.id === subFormationId)
          setSubFormation(found ?? null)
        }
      }
      if (pRes.ok) {
        const list = await pRes.json()
        setPlays(Array.isArray(list) ? list : [])
      } else {
        setPlays([])
        showToast("Could not load plays", "error")
      }
      if (dcRes.ok) {
        const dc = await dcRes.json()
        setDepthChartEntries(dc.entries ?? [])
      }
    } catch (e) {
      console.error("Failed to load sub-formation", e)
    } finally {
      setLoading(false)
    }
  }, [formationId, subFormationId, teamId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const handleDuplicatePlay = useCallback(
    async (playId: string) => {
      try {
        const res = await fetch(`/api/plays/${playId}/duplicate`, { method: "POST" })
        if (!res.ok) throw new Error("Failed to duplicate")
        const newPlay = await res.json()
        showToast("Play duplicated", "success")
        const returnUrl = `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}`
        router.push(`/dashboard/playbooks/play/${newPlay.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
      } catch {
        showToast("Could not duplicate play", "error")
      }
    },
    [playbookId, formationId, subFormationId, router, showToast]
  )

  const handleDuplicateSubFormation = useCallback(async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/sub-formations/${subFormationId}/duplicate`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to duplicate")
      const newSub = await res.json()
      showToast("Sub-formation duplicated", "success")
      router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${newSub.id}/edit`)
    } catch {
      showToast("Could not duplicate sub-formation", "error")
    } finally {
      setDuplicating(false)
    }
  }, [subFormationId, playbookId, formationId, router, showToast])

  const filteredPlays = filterPlaysBySearch(filterPlaysByTags(plays, tagFilterSelected), playSearchQuery)

  const handleReorderPlays = useCallback((reordered: PlayRecord[]) => {
    setPlays(reordered)
  }, [])

  const handleConfirmDeleteSubFormation = useCallback(async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/sub-formations/${subFormationId}`, { method: "DELETE" })
      if (res.ok) {
        showToast("Sub-formation deleted", "success")
        setDeleteDialogOpen(false)
        router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)
      } else {
        showToast("Could not delete sub-formation", "error")
      }
    } catch {
      showToast("Could not delete sub-formation", "error")
    } finally {
      setDeleting(false)
    }
  }, [subFormationId, playbookId, formationId, router, showToast])

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

  const playEditorPath = (playId: string) =>
    `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/play/${playId}/edit`

  const handleGenerateDraftFromConcept = useCallback(
    async (concept: RecommendedConcept, variantId?: string) => {
      if (!formation || !subFormation || !canEdit) return
      const defaultTemplate = { fieldView: "HALF" as const, shapes: [], paths: [] }
      const template = subFormation.templateData ?? formation.templateData ?? defaultTemplate
      const side = subFormation.side ?? formation.side
      const { canvasData, hasRoutes } = generatePlayFromConcept({
        templateData: template,
        conceptName: concept.name,
        side,
        variant: variantId ?? null,
      })
      try {
        const res = await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            playbookId,
            formationId,
            subFormationId,
            side,
            formation: formation.name,
            name: concept.name,
            canvasData,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast("Could not create draft play", "error")
          return
        }
        const play = data as { id: string }
        showToast(hasRoutes ? "Draft play created" : "Draft created without routes", "success")
        router.push(
          `/dashboard/playbooks/play/${play.id}?returnUrl=${encodeURIComponent(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}`)}`
        )
      } catch {
        showToast("Could not create draft play", "error")
      }
    },
    [formation, subFormation, canEdit, teamId, playbookId, formationId, subFormationId, router, showToast]
  )

  const handleCoachBCreateDraft = useCallback(
    async (suggestion: PlaySuggestion) => {
      if (!formation || !subFormation || !canEdit) return
      const defaultTemplate = { fieldView: "HALF" as const, shapes: [], paths: [] }
      const template = subFormation.templateData ?? formation.templateData ?? defaultTemplate
      const side = subFormation.side ?? formation.side
      const conceptName = suggestion.concept?.trim()
      const { canvasData } =
        conceptName && side === "offense"
          ? generatePlayFromConcept({
              templateData: template,
              conceptName,
              side,
            })
          : { canvasData: templateDataToCanvasData(template, side) }
      const body: Record<string, unknown> = {
        teamId,
        playbookId,
        formationId,
        subFormationId,
        side,
        formation: formation.name,
        name: suggestion.playName,
        canvasData,
      }
      if (suggestion.tags?.length) body.tags = suggestion.tags
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Could not create draft play")
      const play = data as { id: string }
      router.push(
        `/dashboard/playbooks/play/${play.id}?returnUrl=${encodeURIComponent(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}`)}`
      )
    },
    [formation, subFormation, canEdit, teamId, playbookId, formationId, subFormationId, router]
  )

  if (loading) {
    return (
      <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="h-4 w-48 bg-slate-200 rounded animate-pulse mb-3" />
          <div className="h-7 w-48 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-full max-w-sm bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-5 sm:p-6 bg-slate-50">
          <section>
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }
  if (!subFormation || !formation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-sm text-slate-500">Sub-formation not found</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
    )
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: "Playbook", href: `/dashboard/playbooks/${playbookId}` },
    { label: formation.name, href: `/dashboard/playbooks/${playbookId}/formation/${formationId}` },
    { label: subFormation.name, href: `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}` },
  ]

  return (
    <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
        <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{subFormation.name}</h1>
            <p className="mt-1 text-sm text-slate-600">Plays in this sub-formation.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {canEdit && (
              <>
                <Button size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/edit`)}>
                  Edit sub-formation
                </Button>
                <Button size="sm" variant="outline" disabled={duplicating} onClick={handleDuplicateSubFormation}>
                  <Copy className="h-4 w-4 mr-1" /> Duplicate sub-formation
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete sub-formation
                </Button>
                <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/play/new`)}>
                  <Plus className="h-4 w-4 mr-1" /> New play
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <div className="min-w-0 space-y-8">
            <section>
              <FormationIntelligencePanel
                formationName={formation.name}
                subFormationName={subFormation.name}
                plays={plays}
                className="max-w-md"
                onGenerateDraft={canEdit ? handleGenerateDraftFromConcept : undefined}
                selectedConcept={previewConceptSelected}
                onConceptHover={setPreviewConceptHover}
                onConceptSelect={setPreviewConceptSelected}
                onClearPreview={() => setPreviewConceptSelected(null)}
              />
            </section>
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Coach B</h2>
              <CoachBAssistedPanel
                teamId={teamId}
                playbookId={playbookId}
                formationId={formationId}
                subFormationId={subFormationId}
                onCreateDraft={handleCoachBCreateDraft}
                canEdit={canEdit}
                className="max-w-md"
              />
            </section>
            {plays.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 bg-white/80">
                <p className="text-slate-600 font-medium">No plays yet</p>
                <p className="text-sm text-slate-500 mt-1">Add a play to this sub-formation to get started.</p>
                {canEdit && (
                  <Button size="sm" className="mt-4" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/play/new`)}>
                    <Plus className="h-4 w-4 mr-1" /> New play
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Plays (this sub-formation)</h2>
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
                  plays={filteredPlays}
                  formations={formation ? [formation] : []}
                  depthChartEntries={depthChartEntries}
                  canEdit={canEdit && !playSearchQuery.trim()}
                  playEditorPath={playEditorPath}
                  onDuplicate={handleDuplicatePlay}
                  onRename={handleRenamePlay}
                  onDelete={handleDeletePlay}
                  onReorder={handleReorderPlays}
                  reorderScopeKey={subFormationId}
                />
              </>
            )}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Collaboration</h2>
              <CommentThreadPanel parentType="sub_formation" parentId={subFormationId} defaultCollapsed={true} />
            </section>
          </div>
          <div className="min-w-0 flex flex-col lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Sub-formation preview</h2>
            <FormationPreview
              templateData={subFormation.templateData ?? formation.templateData ?? null}
              side={subFormation.side ?? formation.side ?? "offense"}
              previewConcept={previewConceptHover ?? previewConceptSelected}
              className="w-full flex-1 min-h-[280]"
            />
          </div>
        </div>
      </div>
      <ConfirmDestructiveDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this sub-formation?"
        message="This will also permanently delete all plays inside this sub-formation. This action cannot be undone."
        impactItems={deleteImpact ? [{ label: "Plays to delete", value: deleteImpact.playsCount }] : undefined}
        isLoadingImpact={deleteImpactLoading}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDeleteSubFormation}
        isDeleting={deleting}
      />
    </div>
  )
}

export default function SubFormationDetailPage() {
  const params = useParams()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null
  const subFormationId = typeof params?.subFormationId === "string" ? params.subFormationId : null

  if (!playbookId || !formationId || !subFormationId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid route</p>}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <SubFormationDetailContent
          playbookId={playbookId}
          formationId={formationId}
          subFormationId={subFormationId}
          teamId={teamId}
          canEdit={canEdit}
        />
      )}
    </DashboardPageShell>
  )
}
