"use client"

/**
 * Playbook browser: 4-level card flow.
 * Level 1: Side (Offense / Defense / Special Teams)
 * Level 2: Formation cards for that side
 * Level 3: Sub-formation cards for that formation
 * Level 4: Play cards for that sub-formation
 * Card-based, not tree. Breadcrumb and back for navigation.
 */
import { useState, useMemo } from "react"
import { Search, Plus, LayoutGrid, List, Presentation, ChevronRight, ArrowLeft, FolderOpen, FileText, Trash2, Pencil } from "lucide-react"

/** Football-style icon (oval with laces) for playbook side cards. */
function FootballIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <ellipse cx="24" cy="14" rx="22" ry="12" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
      <path
        d="M8 14h32M24 6v16M14 8l20 12M14 20l20-12M18 10l12 8M18 18l12-8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { PlayCard } from "@/components/portal/play-card"
import { FormationThumbnail } from "@/components/portal/formation-thumbnail"
import { PlaybookCategoryCard } from "@/components/portal/playbook-category-card"
import type { PlayRecord, FormationRecord, SubFormationRecord, SideOfBall } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import { getAssignmentSummary, type AssignmentSummary } from "@/lib/utils/playbook-assignment"

type ViewMode = "grid" | "list"
type SortKey = "name" | "updated" | "formation" | "unassigned_desc" | "unassigned_asc" | "complete_desc"
type AssignmentFilter = "all" | "fully" | "partial" | "unassigned"
/** Level 4 only: filter by play type. Empty string = All (includes plays with no playType). */
type PlayTypeFilter = "" | "run" | "pass" | "rpo" | "screen"

const SIDES: { value: SideOfBall; label: string; description: string }[] = [
  { value: "offense", label: "Offense", description: "Core offensive structures and families" },
  { value: "defense", label: "Defense", description: "Fronts, coverages, and situational packages" },
  { value: "special_teams", label: "Special Teams", description: "Kicking, return, and field-position units" },
]

const UNCATEGORIZED_ID = "__uncategorized__"

interface PlaybookBrowserProps {
  plays: PlayRecord[]
  formations: FormationRecord[]
  subFormations: SubFormationRecord[]
  depthChartEntries?: DepthChartSlot[] | null
  /** When null, Level 1 (side selection) is shown. */
  selectedSide: SideOfBall | null
  selectedFormationId: string | null
  selectedSubFormationId: string | null
  selectedPlayId: string | null
  onSelectSide: (side: SideOfBall | null) => void
  onSelectFormation: (formationId: string | null, formationName: string, side: SideOfBall) => void
  onSelectSubFormation: (subFormationId: string | null, subFormationName: string) => void
  onSelectPlay: (play: PlayRecord) => void
  onBack: () => void
  onNewPlay: (side: SideOfBall, formationId: string | null, formationName: string, subFormationId?: string | null) => void
  onNewFormation: (side: SideOfBall) => void
  onNewSubFormation: (formationId: string, formationName: string, side: SideOfBall, name: string) => void
  onNewPlayFromFormation: (formation: FormationRecord) => void
  onDuplicatePlay: (playId: string) => void
  onRenamePlay: (playId: string, newName: string) => void
  onRenameFormation: (formationId: string, oldName: string, newName: string) => void
  onRenameSubFormation: (subFormationId: string, oldName: string, newName: string) => void
  onDeletePlay: (playId: string) => void
  onDeleteFormation: (formationId: string) => void
  onDeleteSubFormation: (subFormationId: string) => void
  onStartPlaycaller: () => void
  onReviewAssignments?: (play: PlayRecord) => void
  /** When provided, "Open" on a play navigates to this URL with playId (e.g. open in new window). */
  playEditorPath?: (playId: string) => string
  canEdit: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
}

export function PlaybookBrowser({
  plays,
  formations,
  subFormations,
  depthChartEntries,
  selectedSide,
  selectedFormationId,
  selectedSubFormationId,
  selectedPlayId,
  onSelectSide,
  onSelectFormation,
  onSelectSubFormation,
  onSelectPlay,
  onBack,
  onNewPlay,
  onNewFormation,
  onNewSubFormation,
  onNewPlayFromFormation,
  onDuplicatePlay,
  onRenamePlay,
  onRenameFormation,
  onRenameSubFormation,
  onDeletePlay,
  onDeleteFormation,
  onDeleteSubFormation,
  onStartPlaycaller,
  onReviewAssignments,
  playEditorPath,
  canEdit,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
}: PlaybookBrowserProps) {
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortBy, setSortBy] = useState<SortKey>("updated")
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all")
  const [playTypeFilter, setPlayTypeFilter] = useState<PlayTypeFilter>("")
  const [newSubFormationPrompt, setNewSubFormationPrompt] = useState<{
    formationId: string
    formationName: string
    side: SideOfBall
  } | null>(null)
  const [newSubFormationName, setNewSubFormationName] = useState("")
  const [editingSubFormationId, setEditingSubFormationId] = useState<string | null>(null)
  const [editingSubFormationValue, setEditingSubFormationValue] = useState("")

  const selectedFormation = formations.find((f) => f.id === selectedFormationId) ?? null
  const selectedSubFormation = selectedSubFormationId && selectedSubFormationId !== UNCATEGORIZED_ID
    ? subFormations.find((s) => s.id === selectedSubFormationId) ?? null
    : null

  const canEditSide = (side: SideOfBall) => {
    if (side === "offense") return canEdit && canEditOffense
    if (side === "defense") return canEdit && canEditDefense
    return canEdit && canEditSpecialTeams
  }

  // Level 1: no side selected -> show side cards
  const atSideLevel = selectedSide == null
  // Level 2: side selected, no formation -> show formation cards for that side
  const atFormationLevel = selectedSide != null && selectedFormationId == null
  // Level 3: formation selected, no sub-formation -> show sub-formation cards
  const atSubFormationLevel = selectedFormationId != null && selectedSubFormationId == null
  // Level 4: sub-formation selected -> show play cards
  const atPlayLevel = selectedFormationId != null && selectedSubFormationId != null

  const formationCardsFiltered = useMemo(() => {
    if (!selectedSide) return []
    return formations
      .filter((f) => f.side === selectedSide)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [formations, selectedSide])

  const subFormationsForSelectedFormation = useMemo(() => {
    if (!selectedFormationId) return []
    return subFormations
      .filter((s) => s.formationId === selectedFormationId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [subFormations, selectedFormationId])

  const playsForFormation = useMemo(() => {
    return plays.filter((p) => p.formationId === selectedFormationId)
  }, [plays, selectedFormationId])

  const playsForSubFormation = useMemo(() => {
    if (!selectedFormationId) return []
    if (selectedSubFormationId === UNCATEGORIZED_ID) {
      return playsForFormation.filter((p) => !p.subFormationId)
    }
    if (!selectedSubFormationId) return []
    return playsForFormation.filter((p) => p.subFormationId === selectedSubFormationId)
  }, [playsForFormation, selectedSubFormationId])

  const uncategorizedCount = useMemo(() => playsForFormation.filter((p) => !p.subFormationId).length, [playsForFormation])

  const filteredAndSortedPlays = useMemo(() => {
    let list = playsForSubFormation
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.formation?.toLowerCase().includes(q)) ||
          (p.subFormation?.toLowerCase().includes(q)) ||
          (p.subcategory?.toLowerCase().includes(q))
      )
    }
    if (playTypeFilter) {
      list = list.filter((p) => p.playType === playTypeFilter)
    }
    if (assignmentFilter !== "all" && depthChartEntries?.length) {
      list = list.filter((p) => {
        const sum = getAssignmentSummary(p, depthChartEntries)
        if (!sum || sum.total === 0) return false
        if (assignmentFilter === "fully") return sum.assigned === sum.total
        if (assignmentFilter === "partial") return sum.assigned > 0 && sum.assigned < sum.total
        if (assignmentFilter === "unassigned") return sum.assigned < sum.total
        return true
      })
    }
    const summaryMap = new Map<string, AssignmentSummary | null>()
    list.forEach((p) => summaryMap.set(p.id, getAssignmentSummary(p, depthChartEntries)))
    return [...list].sort((a, b) => {
      if (sortBy === "name") return (a.name ?? "").localeCompare(b.name ?? "")
      if (sortBy === "formation") return (a.formation ?? "").localeCompare(b.formation ?? "") || (a.name ?? "").localeCompare(b.name ?? "")
      if (sortBy === "updated") return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
      const sa = summaryMap.get(a.id)
      const sb = summaryMap.get(b.id)
      const unassignedA = sa ? sa.total - sa.assigned : 0
      const unassignedB = sb ? sb.total - sb.assigned : 0
      if (sortBy === "unassigned_desc") return unassignedB - unassignedA
      if (sortBy === "unassigned_asc") return unassignedA - unassignedB
      if (sortBy === "complete_desc") {
        const ratioA = sa && sa.total ? sa.assigned / sa.total : 1
        const ratioB = sb && sb.total ? sb.assigned / sb.total : 1
        return ratioB - ratioA
      }
      return 0
    })
  }, [playsForSubFormation, search, playTypeFilter, assignmentFilter, sortBy, depthChartEntries])

  const subFormationPlayCount = (subId: string | null) => {
    if (!subId || subId === UNCATEGORIZED_ID) return playsForFormation.filter((p) => !p.subFormationId).length
    return playsForFormation.filter((p) => p.subFormationId === subId).length
  }

  const formationSubCount = (formationId: string) => subFormations.filter((s) => s.formationId === formationId).length
  const formationPlayCount = (formationId: string) => plays.filter((p) => p.formationId === formationId).length

  /** Per-side stats for Level 1: formation count, play count, and formation names for preview. */
  const sideStats = useMemo(() => {
    return SIDES.map((s) => {
      const sideFormations = formations.filter((f) => f.side === s.value)
      const sidePlays = plays.filter((p) => p.side === s.value)
      const formationNames = sideFormations.slice(0, 5).map((f) => f.name)
      return {
        side: s.value,
        formationCount: sideFormations.length,
        playCount: sidePlays.length,
        formationNames,
      }
    })
  }, [formations, plays])

  const handleBack = () => {
    onBack()
  }

  const sideLabel = (side: SideOfBall) => SIDES.find((s) => s.value === side)?.label ?? side

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Breadcrumb + top bar */}
      <div className="flex-shrink-0 border-b border-slate-200 px-4 py-3 space-y-3 rounded-t-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-500">Playbook</span>
          {selectedSide != null && (
            <>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <button
                type="button"
                onClick={() => {
                  onSelectFormation(null, "", selectedSide)
                  onSelectSide(null)
                }}
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                {sideLabel(selectedSide)}
              </button>
            </>
          )}
          {selectedFormation && (
            <>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <button
                type="button"
                onClick={() => {
                  onSelectSubFormation(null, "")
                  onSelectFormation(selectedFormation.id, selectedFormation.name, selectedFormation.side)
                }}
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                {selectedFormation.name}
              </button>
            </>
          )}
          {selectedSubFormationId && (
            <>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                {selectedSubFormationId === UNCATEGORIZED_ID ? "Uncategorized" : selectedSubFormation?.name ?? "—"}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!atSideLevel && (
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          {atPlayLevel && (
            <div className="relative flex-1 min-w-[160px] max-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search plays..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 rounded-md border-slate-200 bg-slate-50 text-sm"
              />
            </div>
          )}
          {atPlayLevel && (
            <select
              value={playTypeFilter}
              onChange={(e) => setPlayTypeFilter(e.target.value as PlayTypeFilter)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 min-w-[100px]"
              title="Filter by play type"
            >
              <option value="">All</option>
              <option value="run">Run</option>
              <option value="pass">Pass</option>
              <option value="rpo">RPO</option>
              <option value="screen">Screen</option>
            </select>
          )}
          {atPlayLevel && (
            <>
              {depthChartEntries?.length ? (
                <select
                  value={assignmentFilter}
                  onChange={(e) => setAssignmentFilter(e.target.value as AssignmentFilter)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 min-w-[140px]"
                >
                  <option value="all">All plays</option>
                  <option value="fully">Fully assigned</option>
                  <option value="partial">Partially assigned</option>
                  <option value="unassigned">Unassigned roles</option>
                </select>
              ) : null}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 min-w-[160px]"
              >
                <option value="updated">Last updated</option>
                <option value="name">Name</option>
                <option value="formation">Formation</option>
                {depthChartEntries?.length ? (
                  <>
                    <option value="unassigned_desc">Most unassigned first</option>
                    <option value="unassigned_asc">Least unassigned first</option>
                    <option value="complete_desc">Most complete first</option>
                  </>
                ) : null}
              </select>
            </>
          )}
          <div className="flex items-center gap-1 rounded-md border border-slate-200 p-0.5 bg-slate-50/80">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          {canEdit && (
            <>
              {atFormationLevel && selectedSide && (
                <Button size="sm" onClick={() => onNewFormation(selectedSide)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Formation
                </Button>
              )}
              {atSubFormationLevel && selectedFormation && !newSubFormationPrompt && (
                <Button size="sm" onClick={() => { setNewSubFormationPrompt({ formationId: selectedFormation.id, formationName: selectedFormation.name, side: selectedFormation.side }); setNewSubFormationName(""); }}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Sub-Formation
                </Button>
              )}
              {atPlayLevel && selectedFormation && (
                <Button size="sm" onClick={() => {
                  onNewPlay(selectedFormation.side, selectedFormation.id, selectedFormation.name, selectedSubFormationId === UNCATEGORIZED_ID ? null : selectedSubFormationId ?? undefined)
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Play
                </Button>
              )}
            </>
          )}
          {atSubFormationLevel || atPlayLevel ? (
            plays.length > 0 && (
              <Button variant="outline" size="sm" onClick={onStartPlaycaller} title="Presentation mode">
                <Presentation className="h-4 w-4 mr-1" />
                Present
              </Button>
            )
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {/* Level 1: Side selection — Playbook Hub category cards */}
        {atSideLevel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Playbook Browser
              </h2>
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-1 bg-slate-50/80">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-md"
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-md"
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-5 min-w-0">
              {SIDES.map((s, idx) => {
                const stats = sideStats[idx]
                const formationCount = stats?.formationCount ?? 0
                const playCount = stats?.playCount ?? 0
                const formationNames = stats?.formationNames ?? []
                return (
                  <PlaybookCategoryCard
                    key={s.value}
                    side={s.value}
                    label={s.label}
                    description={s.description}
                    formationCount={formationCount}
                    playCount={playCount}
                    formationNames={formationNames}
                    onSelect={() => onSelectSide(s.value)}
                    browseLabel={`Browse ${s.label}`}
                    onCreateFormation={canEditSide(s.value) ? () => onNewFormation(s.value) : undefined}
                    canEdit={canEditSide(s.value)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Level 2: Formation cards — same polish as Level 1, thumbnail + counts + preview */}
        {atFormationLevel && selectedSide && (
          <>
            {formationCardsFiltered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-slate-700 font-medium">No formations yet</p>
                <p className="text-sm text-slate-500 mt-1">Create a formation to organize your playbook.</p>
                {canEdit && (
                  <div className="mt-4">
                    <Button size="sm" onClick={() => onNewFormation(selectedSide)}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Formation
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                {formationCardsFiltered.map((f) => {
                  const subCount = formationSubCount(f.id)
                  const playCount = formationPlayCount(f.id)
                  const subNames = subFormations.filter((s) => s.formationId === f.id).slice(0, 4).map((s) => s.name)
                  const isOffense = f.side === "offense"
                  const isDefense = f.side === "defense"
                  const accentBg = isOffense
                    ? "bg-blue-500/10 border-blue-200 hover:border-blue-500 hover:shadow-xl"
                    : isDefense
                    ? "bg-red-500/10 border-red-200 hover:border-red-500 hover:shadow-xl"
                    : "bg-amber-500/10 border-amber-200 hover:border-amber-500 hover:shadow-xl"
                  const barBg = isOffense ? "bg-blue-600" : isDefense ? "bg-red-600" : "bg-amber-600"
                  const hasTemplate = f.templateData?.shapes?.length > 0
                  return (
                    <Card
                      key={f.id}
                      className={`cursor-pointer overflow-hidden border-2 transition-all shadow-sm p-0 relative ${accentBg}`}
                      onClick={() => onSelectFormation(f.id, f.name, f.side)}
                    >
                      {hasTemplate ? (
                        <FormationThumbnail templateData={f.templateData} side={f.side} className="rounded-t-lg" />
                      ) : (
                        <div className="aspect-[200/140] bg-slate-100 rounded-t-lg flex items-center justify-center">
                          <FootballIcon
                            className={`h-14 w-14 ${isOffense ? "text-blue-500/50" : isDefense ? "text-red-500/50" : "text-amber-500/50"}`}
                          />
                        </div>
                      )}
                      <div className={`${barBg} px-4 py-3 text-center`}>
                        <span className="font-bold text-white text-lg tracking-tight">{f.name}</span>
                      </div>
                      <CardContent className="p-4 flex flex-col min-h-[100px]">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Sub-formations</p>
                            <p className="text-xl font-bold text-slate-800">{subCount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Plays</p>
                            <p className="text-xl font-bold text-slate-800">{playCount}</p>
                          </div>
                        </div>
                        {subNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mt-auto">
                            {subNames.map((name) => (
                              <span
                                key={name}
                                className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                              >
                                {name}
                              </span>
                            ))}
                            {subCount > subNames.length && (
                              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">
                                +{subCount - subNames.length}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 mt-auto">No sub-formations yet</p>
                        )}
                      </CardContent>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 z-10 bg-white/90 hover:bg-destructive/20 hover:text-destructive rounded-full shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Delete formation "${f.name}"? This will not delete sub-formations or plays; you can reassign them later.`)) {
                              onDeleteFormation(f.id)
                            }
                          }}
                          title="Delete formation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Level 3: Sub-formation cards — formation tiles: preview + strong blue footer + play count */}
        {atSubFormationLevel && selectedFormation && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800 text-center">{selectedFormation.name}</h2>
              <p className="text-sm text-slate-500 text-center mt-1">Select a sub-formation to view plays</p>
            </div>
            {newSubFormationPrompt && newSubFormationPrompt.formationId === selectedFormation.id && (
              <Card className="mb-5 p-4 border-2 border-blue-200 bg-blue-50/50 max-w-md mx-auto">
                <p className="text-sm font-medium text-slate-700 mb-2">New sub-formation name</p>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    value={newSubFormationName}
                    onChange={(e) => setNewSubFormationName(e.target.value)}
                    placeholder="e.g. Deuce Close"
                    className="flex-1 min-w-[180px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSubFormationName.trim()) {
                        onNewSubFormation(newSubFormationPrompt.formationId, newSubFormationPrompt.formationName, newSubFormationPrompt.side, newSubFormationName.trim())
                        setNewSubFormationPrompt(null)
                        setNewSubFormationName("")
                      }
                      if (e.key === "Escape") {
                        setNewSubFormationPrompt(null)
                        setNewSubFormationName("")
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newSubFormationName.trim()) {
                        onNewSubFormation(newSubFormationPrompt.formationId, newSubFormationPrompt.formationName, newSubFormationPrompt.side, newSubFormationName.trim())
                        setNewSubFormationPrompt(null)
                        setNewSubFormationName("")
                      }
                    }}
                    disabled={!newSubFormationName.trim()}
                  >
                    Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setNewSubFormationPrompt(null); setNewSubFormationName("") }}>
                    Cancel
                  </Button>
                </div>
              </Card>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {subFormationsForSelectedFormation.map((s) => {
                const playCount = subFormationPlayCount(s.id)
                const isEditing = editingSubFormationId === s.id
                return (
                  <Card
                    key={s.id}
                    className="cursor-pointer overflow-hidden border-2 border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all p-0 relative"
                    onClick={() => !isEditing && onSelectSubFormation(s.id, s.name)}
                  >
                    <FormationThumbnail templateData={selectedFormation.templateData} side={selectedFormation.side} />
                    <div className="bg-[#1e40af] px-4 py-4 text-center">
                      {isEditing ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editingSubFormationValue}
                            onChange={(e) => setEditingSubFormationValue(e.target.value)}
                            className="h-8 text-base font-bold text-slate-800 bg-white"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingSubFormationValue.trim()) onRenameSubFormation(s.id, s.name, editingSubFormationValue.trim())
                                setEditingSubFormationId(null)
                                setEditingSubFormationValue("")
                              }
                              if (e.key === "Escape") {
                                setEditingSubFormationId(null)
                                setEditingSubFormationValue("")
                              }
                            }}
                            autoFocus
                          />
                          <span className="text-white/90 text-sm font-medium block">{playCount} play{playCount !== 1 ? "s" : ""}</span>
                        </div>
                      ) : (
                        <>
                          <span className="font-bold text-white text-base block tracking-tight">{s.name}</span>
                          <span className="text-white/90 text-sm font-medium mt-0.5 block">{playCount} play{playCount !== 1 ? "s" : ""}</span>
                        </>
                      )}
                    </div>
                    {canEdit && (
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        {!isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-white/90 hover:bg-slate-200 rounded-full shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSubFormationId(s.id)
                                setEditingSubFormationValue(s.name)
                              }}
                              title="Rename sub-formation"
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-700" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-white/90 hover:bg-destructive/20 hover:text-destructive rounded-full shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(`Delete sub-formation "${s.name}"? Plays in this sub-formation will become uncategorized.`)) {
                                  onDeleteSubFormation(s.id)
                                }
                              }}
                              title="Delete sub-formation"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              className="h-8 bg-white/90 text-slate-800"
                              onClick={() => {
                                if (editingSubFormationValue.trim()) onRenameSubFormation(s.id, s.name, editingSubFormationValue.trim())
                                setEditingSubFormationId(null)
                                setEditingSubFormationValue("")
                              }}
                              disabled={!editingSubFormationValue.trim()}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 bg-white/90 text-slate-700"
                              onClick={() => { setEditingSubFormationId(null); setEditingSubFormationValue("") }}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
              {uncategorizedCount > 0 && (
                <Card
                  className="cursor-pointer overflow-hidden border-2 border-dashed border-slate-300 hover:border-slate-500 hover:shadow-lg transition-all p-0"
                  onClick={() => onSelectSubFormation(UNCATEGORIZED_ID, "Uncategorized")}
                >
                  <div className="aspect-[200/140] bg-slate-100 flex items-center justify-center rounded-t-lg">
                    <FileText className="h-14 w-14 text-slate-400" />
                  </div>
                  <div className="bg-slate-600 px-4 py-4 text-center">
                    <span className="font-bold text-white text-base block tracking-tight">Uncategorized</span>
                    <span className="text-white/90 text-sm font-medium mt-0.5 block">{uncategorizedCount} play{uncategorizedCount !== 1 ? "s" : ""}</span>
                  </div>
                </Card>
              )}
            </div>
            {subFormationsForSelectedFormation.length === 0 && uncategorizedCount === 0 && !newSubFormationPrompt && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-slate-700 font-medium">No sub-formations yet</p>
                <p className="text-sm text-slate-500 mt-1">Create a sub-formation or add plays directly (they will appear under Uncategorized).</p>
                {canEdit && (
                  <Button size="sm" className="mt-4" onClick={() => { setNewSubFormationPrompt({ formationId: selectedFormation.id, formationName: selectedFormation.name, side: selectedFormation.side }); setNewSubFormationName(""); }}>
                    <Plus className="h-4 w-4 mr-1" />
                    New Sub-Formation
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {/* Level 4: Play cards */}
        {atPlayLevel && (
          <>
            {filteredAndSortedPlays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-slate-700 font-medium">
                  {playsForSubFormation.length === 0 ? "No plays in this sub-formation" : "No plays match your search"}
                </p>
                {canEdit && selectedFormation && (
                  <Button size="sm" className="mt-4" onClick={() => onNewPlay(selectedFormation.side, selectedFormation.id, selectedFormation.name, selectedSubFormationId === UNCATEGORIZED_ID ? null : selectedSubFormationId ?? undefined)}>
                    <Plus className="h-4 w-4 mr-1" />
                    New Play
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {filteredAndSortedPlays.map((play) => (
                      <PlayCard
                        key={play.id}
                        play={play}
                        formations={formations}
                        depthChartEntries={depthChartEntries}
                        isSelected={selectedPlayId === play.id}
                        onOpen={onSelectPlay}
                        onDuplicate={onDuplicatePlay}
                        onRename={onRenamePlay}
                        onDelete={onDeletePlay}
                        onReviewAssignments={onReviewAssignments}
                        canEdit={canEdit}
                        viewMode="grid"
                        playEditorPath={playEditorPath}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAndSortedPlays.map((play) => (
                      <PlayCard
                        key={play.id}
                        play={play}
                        formations={formations}
                        depthChartEntries={depthChartEntries}
                        isSelected={selectedPlayId === play.id}
                        onOpen={onSelectPlay}
                        onDuplicate={onDuplicatePlay}
                        onRename={onRenamePlay}
                        onDelete={onDeletePlay}
                        onReviewAssignments={onReviewAssignments}
                        canEdit={canEdit}
                        viewMode="list"
                        playEditorPath={playEditorPath}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
