"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Plus, ArrowLeft, Copy, Search, Trash2, MoreHorizontal } from "lucide-react"
import { PlaybookBottomSheet } from "@/components/portal/playbook-bottom-sheet"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { FormationThumbnail } from "@/components/portal/formation-thumbnail"
import { SortablePlayList } from "@/components/portal/sortable-play-list"
import { ConfirmDestructiveDialog } from "@/components/portal/confirm-destructive-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { filterPlaysBySearch, filterPlaysByTags } from "@/lib/utils/play-search"
import { PlayTagFilter } from "@/components/portal/play-tag-filter"
import type { FormationRecord, SubFormationRecord, PlayRecord } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import { CommentThreadPanel } from "@/components/portal/comment-thread-panel"
import { FormationIntelligencePanel } from "@/components/portal/formation-intelligence-panel"
import type { RecommendedConcept } from "@/lib/constants/formation-concept-recommendations"
import { generatePlayFromConcept } from "@/lib/play-generation/generate-play-from-concept"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { CoachBAssistedPanel } from "@/components/portal/coach-b-assisted-panel"
import { FormationPreview } from "@/components/portal/formation-preview"
import type { PlaySuggestion } from "@/lib/types/coach-b"

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
  const { showToast } = usePlaybookToast()
  const [formation, setFormation] = useState<FormationRecord | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [subFormations, setSubFormations] = useState<SubFormationRecord[]>([])
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [playSearchQuery, setPlaySearchQuery] = useState("")
  const [tagFilterSelected, setTagFilterSelected] = useState<string[]>([])
  const [formationDeleteDialogOpen, setFormationDeleteDialogOpen] = useState(false)
  const [formationDeleteImpact, setFormationDeleteImpact] = useState<{
    subFormationsCount: number
    directPlaysCount: number
    subFormationPlaysCount: number
    totalPlaysCount: number
  } | null>(null)
  const [formationDeleteImpactLoading, setFormationDeleteImpactLoading] = useState(false)
  const [formationDeleting, setFormationDeleting] = useState(false)
  const [subFormationToDeleteId, setSubFormationToDeleteId] = useState<string | null>(null)
  const [subFormationDeleteImpact, setSubFormationDeleteImpact] = useState<{ playsCount: number } | null>(null)
  const [subFormationDeleteImpactLoading, setSubFormationDeleteImpactLoading] = useState(false)
  const [subFormationDeleting, setSubFormationDeleting] = useState(false)
  const [previewConceptHover, setPreviewConceptHover] = useState<RecommendedConcept | null>(null)
  const [previewConceptSelected, setPreviewConceptSelected] = useState<RecommendedConcept | null>(null)
  const [mobileTab, setMobileTab] = useState<"preview" | "concepts" | "coachb" | "plays">("preview")
  const [formationMoreOpen, setFormationMoreOpen] = useState(false)

  useEffect(() => {
    if (!formationDeleteDialogOpen) return
    setFormationDeleteImpactLoading(true)
    fetch(`/api/formations/${formationId}/delete-impact`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setFormationDeleteImpact)
      .catch(() => setFormationDeleteImpact(null))
      .finally(() => setFormationDeleteImpactLoading(false))
  }, [formationDeleteDialogOpen, formationId])

  useEffect(() => {
    if (!subFormationToDeleteId) return
    setSubFormationDeleteImpactLoading(true)
    fetch(`/api/sub-formations/${subFormationToDeleteId}/delete-impact`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSubFormationDeleteImpact)
      .catch(() => setSubFormationDeleteImpact(null))
      .finally(() => setSubFormationDeleteImpactLoading(false))
  }, [subFormationToDeleteId])

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
      if (pRes.ok) {
        setPlays(await pRes.json())
      } else {
        setPlays([])
        showToast("Could not load plays", "error")
      }
      if (dcRes.ok) {
        const dc = await dcRes.json()
        setDepthChartEntries(dc.entries ?? [])
      }
    } catch (e) {
      console.error("Failed to load formation detail", e)
    } finally {
      setLoading(false)
    }
  }, [formationId, teamId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const playsForSubFormation = (subId: string | null) =>
    subId ? plays.filter((p) => p.subFormationId === subId) : plays.filter((p) => !p.subFormationId)

  const handleDuplicateSubFormation = useCallback(
    async (subId: string) => {
      try {
        const res = await fetch(`/api/sub-formations/${subId}/duplicate`, { method: "POST" })
        if (!res.ok) throw new Error("Failed to duplicate")
        const newSub = await res.json()
        showToast("Sub-formation duplicated", "success")
        router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${newSub.id}/edit`)
      } catch {
        showToast("Could not duplicate sub-formation", "error")
      }
    },
    [playbookId, formationId, router, showToast]
  )

  const handleDuplicatePlay = useCallback(
    async (playId: string) => {
      try {
        const res = await fetch(`/api/plays/${playId}/duplicate`, { method: "POST" })
        if (!res.ok) throw new Error("Failed to duplicate")
        const newPlay = await res.json()
        showToast("Play duplicated", "success")
        const returnUrl = `/dashboard/playbooks/${playbookId}/formation/${formationId}`
        router.push(`/dashboard/playbooks/play/${newPlay.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
      } catch {
        showToast("Could not duplicate play", "error")
      }
    },
    [playbookId, formationId, router, showToast]
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

  const playEditorPath = (playId: string) => `/dashboard/playbooks/${playbookId}/formation/${formationId}/play/${playId}/edit`

  const handleGenerateDraftFromConcept = useCallback(
    async (concept: RecommendedConcept, variantId?: string) => {
      if (!formation || !canEdit) return
      const defaultTemplate = { fieldView: "HALF" as const, shapes: [], paths: [] }
      const template = formation.templateData ?? defaultTemplate
      const { canvasData, hasRoutes } = generatePlayFromConcept({
        templateData: template,
        conceptName: concept.name,
        side: formation.side,
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
            side: formation.side,
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
        router.push(`/dashboard/playbooks/play/${play.id}?returnUrl=${encodeURIComponent(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)}`)
      } catch {
        showToast("Could not create draft play", "error")
      }
    },
    [formation, canEdit, teamId, playbookId, formationId, router, showToast]
  )

  const handleCoachBCreateDraft = useCallback(
    async (suggestion: PlaySuggestion) => {
      if (!formation || !canEdit) return
      const defaultTemplate = { fieldView: "HALF" as const, shapes: [], paths: [] }
      const template = formation.templateData ?? defaultTemplate
      const conceptName = suggestion.concept?.trim()
      const { canvasData } =
        conceptName && formation.side === "offense"
          ? generatePlayFromConcept({
              templateData: template,
              conceptName,
              side: formation.side,
            })
          : { canvasData: templateDataToCanvasData(template, formation.side) }
      const body: Record<string, unknown> = {
        teamId,
        playbookId,
        formationId,
        side: formation.side,
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
      router.push(`/dashboard/playbooks/play/${play.id}?returnUrl=${encodeURIComponent(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)}`)
    },
    [formation, canEdit, teamId, playbookId, formationId, router]
  )

  const filteredPlays = filterPlaysBySearch(filterPlaysByTags(plays, tagFilterSelected), playSearchQuery)

  const handleReorderPlays = useCallback((reordered: PlayRecord[]) => {
    setPlays(reordered)
  }, [])

  const handleDuplicateFormation = useCallback(async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/formations/${formationId}/duplicate`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to duplicate")
      const newFormation = await res.json()
      showToast("Formation duplicated", "success")
      router.push(`/dashboard/playbooks/${playbookId}/formation/${newFormation.id}/edit`)
    } catch {
      showToast("Failed to duplicate formation", "error")
    } finally {
      setDuplicating(false)
    }
  }, [formationId, playbookId, router, showToast])

  const handleConfirmDeleteFormation = useCallback(async () => {
    setFormationDeleting(true)
    try {
      const res = await fetch(`/api/formations/${formationId}`, { method: "DELETE" })
      if (res.ok) {
        showToast("Formation deleted", "success")
        setFormationDeleteDialogOpen(false)
        router.push(`/dashboard/playbooks/${playbookId}`)
      } else {
        showToast("Could not delete formation", "error")
      }
    } catch {
      showToast("Could not delete formation", "error")
    } finally {
      setFormationDeleting(false)
    }
  }, [formationId, playbookId, router, showToast])

  const handleConfirmDeleteSubFormation = useCallback(async () => {
    if (!subFormationToDeleteId) return
    setSubFormationDeleting(true)
    try {
      const res = await fetch(`/api/sub-formations/${subFormationToDeleteId}`, { method: "DELETE" })
      if (res.ok) {
        showToast("Sub-formation deleted", "success")
        setSubFormationToDeleteId(null)
        load()
      } else {
        showToast("Could not delete sub-formation", "error")
      }
    } catch {
      showToast("Could not delete sub-formation", "error")
    } finally {
      setSubFormationDeleting(false)
    }
  }, [subFormationToDeleteId, showToast, load])

  if (loading) {
    return (
      <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="h-4 w-48 bg-slate-200 rounded animate-pulse mb-3" />
          <div className="h-7 w-56 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-full max-w-sm bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-5 sm:p-6 bg-slate-50 space-y-8">
          <section>
            <div className="h-4 w-28 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden h-44 animate-pulse">
                  <div className="h-28 bg-slate-200" />
                  <div className="p-4">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-4" />
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
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
        <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
        <div className="min-w-0 mb-3">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-2xl">{formation.name}</h1>
          <p className="mt-1 text-sm text-slate-600">Sub-formations and plays in this formation.</p>
        </div>
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl h-10" onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {canEdit && (
              <>
                <Button size="sm" className="rounded-xl h-10" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/edit`)}>
                  Edit formation
                </Button>
                <Button size="sm" className="rounded-xl h-10" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/new`)}>
                  <Plus className="h-4 w-4 mr-1" /> Sub-form.
                </Button>
                <Button size="sm" variant="secondary" className="rounded-xl h-10" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/play/new`)}>
                  <Plus className="h-4 w-4 mr-1" /> New play
                </Button>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setFormationMoreOpen(true)} title="More">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="hidden lg:flex flex-wrap gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {canEdit && (
            <>
              <Button size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/edit`)}>
                Edit formation
              </Button>
              <Button size="sm" variant="outline" disabled={duplicating} onClick={handleDuplicateFormation}>
                <Copy className="h-4 w-4 mr-1" /> Duplicate formation
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setFormationDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete formation
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

      <PlaybookBottomSheet open={formationMoreOpen} onOpenChange={setFormationMoreOpen} title="Formation actions">
        <Button
          variant="outline"
          className="w-full justify-start h-12 rounded-xl gap-2"
          disabled={duplicating}
          onClick={() => {
            setFormationMoreOpen(false)
            handleDuplicateFormation()
          }}
        >
          <Copy className="h-4 w-4" /> Duplicate formation
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start h-12 rounded-xl gap-2 text-red-600 border-red-200"
          onClick={() => {
            setFormationMoreOpen(false)
            setFormationDeleteDialogOpen(true)
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete formation
        </Button>
      </PlaybookBottomSheet>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-24 md:pb-28 lg:pb-6 bg-slate-50 min-w-0">
        {/* Mobile / tablet: segmented tabs */}
        <div className="lg:hidden mb-4">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 gap-1 overflow-x-auto shadow-sm">
            {(
              [
                ["preview", "Preview"],
                ["concepts", "Concepts"],
                ["coachb", "Coach B"],
                ["plays", "Plays"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMobileTab(id)}
                className={`flex-1 min-w-[4.5rem] py-2.5 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  mobileTab === id ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:hidden space-y-4 min-w-0 max-w-full">
          {mobileTab === "preview" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-w-0">
              <FormationPreview
                templateData={formation.templateData ?? null}
                side={formation.side}
                previewConcept={previewConceptHover ?? previewConceptSelected}
                className="w-full min-h-[280px] max-h-[min(70vh,520px)]"
              />
            </div>
          )}
          {mobileTab === "concepts" && (
            <FormationIntelligencePanel
              formationName={formation.name}
              plays={plays}
              className="max-w-none w-full"
              onGenerateDraft={canEdit ? handleGenerateDraftFromConcept : undefined}
              selectedConcept={previewConceptSelected}
              onConceptHover={setPreviewConceptHover}
              onConceptSelect={setPreviewConceptSelected}
              onClearPreview={() => setPreviewConceptSelected(null)}
            />
          )}
          {mobileTab === "coachb" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Coach B</h2>
              <CoachBAssistedPanel
                teamId={teamId}
                playbookId={playbookId}
                formationId={formationId}
                onCreateDraft={handleCoachBCreateDraft}
                canEdit={canEdit}
                className="max-w-none w-full"
              />
            </div>
          )}
          {mobileTab === "plays" && (
            <div className="space-y-6 min-w-0">
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Sub-formations</h2>
                {subFormations.length === 0 ? (
                  <div className="py-8 text-center rounded-2xl border border-dashed border-slate-200 bg-white/80">
                    <p className="text-slate-600 font-medium text-sm">No sub-formations yet</p>
                    {canEdit && (
                      <Button size="sm" className="mt-4 rounded-xl" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/new`)}>
                        <Plus className="h-4 w-4 mr-1" /> New sub-formation
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {subFormations.map((sf) => {
                      const playCount = playsForSubFormation(sf.id).length
                      return (
                        <Card
                          key={sf.id}
                          className="min-w-0 cursor-pointer overflow-hidden border-2 border-slate-200 rounded-2xl hover:border-slate-400 hover:shadow-lg transition-all p-0"
                          onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${sf.id}`)}
                        >
                          <FormationThumbnail templateData={sf.templateData ?? formation.templateData} side={formation.side} className="rounded-t-xl" />
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 truncate text-sm">{sf.name}</span>
                              <span className="shrink-0 rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums">{playCount} plays</span>
                            </div>
                            {canEdit && (
                              <div className="flex gap-2 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${sf.id}/edit`)}>Edit</Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={() => handleDuplicateSubFormation(sf.id)}><Copy className="h-3 w-3 mr-1" /> Dup</Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 rounded-lg" onClick={() => setSubFormationToDeleteId(sf.id)}>Delete</Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </section>
              <section>
                <div className="flex flex-col gap-3 mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Plays</h2>
                  {plays.length > 0 && (
                    <div className="relative w-full max-w-full">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input type="search" placeholder="Search plays..." value={playSearchQuery} onChange={(e) => setPlaySearchQuery(e.target.value)} className="pl-8 h-10 text-sm rounded-xl" />
                    </div>
                  )}
                  {plays.length > 0 && <PlayTagFilter selectedTags={tagFilterSelected} onChange={setTagFilterSelected} />}
                </div>
                {plays.length === 0 ? (
                  <div className="py-8 text-center rounded-2xl border border-dashed border-slate-200 bg-white/80">
                    <p className="text-slate-600 font-medium text-sm">No plays yet</p>
                    {canEdit && (
                      <Button size="sm" className="mt-4 rounded-xl" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/play/new`)}>
                        <Plus className="h-4 w-4 mr-1" /> New play
                      </Button>
                    )}
                  </div>
                ) : (
                  <SortablePlayList
                    plays={filteredPlays}
                    formations={[formation]}
                    depthChartEntries={depthChartEntries}
                    canEdit={canEdit && !playSearchQuery.trim()}
                    playEditorPath={playEditorPath}
                    onDuplicate={handleDuplicatePlay}
                    onRename={handleRenamePlay}
                    onDelete={handleDeletePlay}
                    onReorder={handleReorderPlays}
                    reorderScopeKey={formationId}
                  />
                )}
              </section>
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">Collaboration</h2>
                <CommentThreadPanel parentType="formation" parentId={formationId} defaultCollapsed={true} />
              </section>
            </div>
          )}
        </div>

        <div className="hidden lg:grid lg:grid-cols-[340px_1fr] gap-6 min-w-0">
          <div className="min-w-0 space-y-8">
            <section>
              <FormationIntelligencePanel
                formationName={formation.name}
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
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Coach B</h2>
              <CoachBAssistedPanel
                teamId={teamId}
                playbookId={playbookId}
                formationId={formationId}
                onCreateDraft={handleCoachBCreateDraft}
                canEdit={canEdit}
                className="max-w-md"
              />
            </section>
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
                  {subFormations.map((sf) => {
                    const playCount = playsForSubFormation(sf.id).length
                    return (
                      <Card
                        key={sf.id}
                        className="min-w-[200px] cursor-pointer overflow-hidden border-2 border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all p-0"
                        onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${sf.id}`)}
                      >
                        <FormationThumbnail templateData={sf.templateData ?? formation.templateData} side={formation.side} className="rounded-t-lg" />
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 block truncate">{sf.name}</span>
                            <span className="shrink-0 rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
                              {playCount} {playCount === 1 ? "play" : "plays"}
                            </span>
                          </div>
                          {canEdit && (
                            <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${sf.id}/edit`)}>
                                Edit
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDuplicateSubFormation(sf.id)}>
                                <Copy className="h-3 w-3 mr-1" /> Duplicate
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => setSubFormationToDeleteId(sf.id)}>
                                Delete
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Plays (this formation)</h2>
                  {plays.length > 0 && (
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
                  )}
                </div>
                {plays.length > 0 && <PlayTagFilter selectedTags={tagFilterSelected} onChange={setTagFilterSelected} />}
              </div>
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
                <SortablePlayList
                  plays={filteredPlays}
                  formations={[formation]}
                  depthChartEntries={depthChartEntries}
                  canEdit={canEdit && !playSearchQuery.trim()}
                  playEditorPath={playEditorPath}
                  onDuplicate={handleDuplicatePlay}
                  onRename={handleRenamePlay}
                  onDelete={handleDeletePlay}
                  onReorder={handleReorderPlays}
                  reorderScopeKey={formationId}
                />
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Collaboration</h2>
              <CommentThreadPanel parentType="formation" parentId={formationId} defaultCollapsed={true} />
            </section>
          </div>
          <div className="min-w-0 flex flex-col lg:sticky lg:top-6 lg:self-start max-w-full overflow-hidden">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Formation preview</h2>
            <FormationPreview
              templateData={formation.templateData ?? null}
              side={formation.side}
              previewConcept={previewConceptHover ?? previewConceptSelected}
              className="w-full flex-1 min-h-[280px] min-w-0 max-w-full"
            />
          </div>
        </div>
      </div>
      <ConfirmDestructiveDialog
        open={formationDeleteDialogOpen}
        onOpenChange={setFormationDeleteDialogOpen}
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
      <ConfirmDestructiveDialog
        open={!!subFormationToDeleteId}
        onOpenChange={(open) => !open && setSubFormationToDeleteId(null)}
        title="Delete this sub-formation?"
        message="This will also permanently delete all plays inside this sub-formation. This action cannot be undone."
        impactItems={subFormationDeleteImpact ? [
          { label: "Plays to delete", value: subFormationDeleteImpact.playsCount },
        ] : undefined}
        isLoadingImpact={subFormationDeleteImpactLoading}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDeleteSubFormation}
        isDeleting={subFormationDeleting}
      />
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
