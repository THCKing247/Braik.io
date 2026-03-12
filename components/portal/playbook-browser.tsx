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
import { Search, Plus, LayoutGrid, List, Presentation, ChevronRight, ArrowLeft, FolderOpen, FileText, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { PlayCard } from "@/components/portal/play-card"
import { FormationThumbnail } from "@/components/portal/formation-thumbnail"
import type { PlayRecord, FormationRecord, SubFormationRecord, SideOfBall } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import { getAssignmentSummary, type AssignmentSummary } from "@/lib/utils/playbook-assignment"

type ViewMode = "grid" | "list"
type SortKey = "name" | "updated" | "formation" | "unassigned_desc" | "unassigned_asc" | "complete_desc"
type AssignmentFilter = "all" | "fully" | "partial" | "unassigned"

const SIDES: { value: SideOfBall; label: string }[] = [
  { value: "offense", label: "Offense" },
  { value: "defense", label: "Defense" },
  { value: "special_teams", label: "Special Teams" },
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
  onNewSubFormation: (formationId: string, formationName: string, side: SideOfBall) => void
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
  const [newFormationMenuOpen, setNewFormationMenuOpen] = useState(false)

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
  }, [playsForSubFormation, search, assignmentFilter, sortBy, depthChartEntries])

  const subFormationPlayCount = (subId: string | null) => {
    if (!subId || subId === UNCATEGORIZED_ID) return playsForFormation.filter((p) => !p.subFormationId).length
    return playsForFormation.filter((p) => p.subFormationId === subId).length
  }

  const formationSubCount = (formationId: string) => subFormations.filter((s) => s.formationId === formationId).length
  const formationPlayCount = (formationId: string) => plays.filter((p) => p.formationId === formationId).length

  const handleBack = () => {
    onBack()
  }

  const sideLabel = (side: SideOfBall) => SIDES.find((s) => s.value === side)?.label ?? side

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Breadcrumb + top bar */}
      <div className="flex-shrink-0 border-b border-slate-200 px-4 py-3 space-y-3">
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
              {atSideLevel && (
                <div className="relative">
                  <Button size="sm" onClick={() => { setNewFormationMenuOpen(!newFormationMenuOpen); }}>
                    <Plus className="h-4 w-4 mr-1" />
                    New Formation
                  </Button>
                  {newFormationMenuOpen && (
                    <>
                      <div className="absolute left-0 top-full mt-1 z-20 py-1 rounded-lg border border-slate-200 bg-white shadow-lg min-w-[140px]">
                        {SIDES.map((s) => (
                          <button
                            key={s.value}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            disabled={!canEditSide(s.value)}
                            onClick={() => { onNewFormation(s.value); setNewFormationMenuOpen(false); }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <div className="fixed inset-0 z-10" onClick={() => setNewFormationMenuOpen(false)} aria-hidden />
                    </>
                  )}
                </div>
              )}
              {atFormationLevel && selectedSide && (
                <Button size="sm" onClick={() => onNewFormation(selectedSide)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Formation
                </Button>
              )}
              {atSubFormationLevel && selectedFormation && (
                <Button size="sm" onClick={() => onNewSubFormation(selectedFormation.id, selectedFormation.name, selectedFormation.side)}>
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
      <div className="flex-1 overflow-y-auto p-4">
        {/* Level 1: Side selection */}
        {atSideLevel && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {SIDES.map((s) => (
              <Card
                key={s.value}
                className="cursor-pointer overflow-hidden border-2 border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all bg-slate-50/50"
                onClick={() => onSelectSide(s.value)}
              >
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-[140px]">
                  <div className="rounded-full bg-slate-200 p-4 mb-3">
                    <FolderOpen className="h-10 w-10 text-slate-600" />
                  </div>
                  <span className="font-semibold text-lg text-slate-800">{s.label}</span>
                  <span className="text-xs text-slate-500 mt-1 uppercase tracking-wide">
                    {s.value.replace("_", " ")}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Level 2: Formation cards */}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {formationCardsFiltered.map((f) => (
                  <Card
                    key={f.id}
                    className="cursor-pointer overflow-hidden border-2 border-slate-200 hover:border-blue-500 hover:shadow-md transition-all relative"
                    onClick={() => onSelectFormation(f.id, f.name, f.side)}
                  >
                    <CardContent className="p-5 flex flex-col gap-2 min-h-[120px] justify-center relative">
                      <div className="flex items-center justify-center gap-2">
                        <FolderOpen className="h-6 w-6 text-slate-500 flex-shrink-0" />
                        <span className="font-semibold text-slate-800 text-center truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                        <span>{formationSubCount(f.id)} sub-formations</span>
                        <span>{formationPlayCount(f.id)} plays</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 text-center">{f.side.replace("_", " ")}</span>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10"
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Level 3: Sub-formation cards */}
        {atSubFormationLevel && selectedFormation && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-800 text-center">{selectedFormation.name}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {subFormationsForSelectedFormation.map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer overflow-hidden border-2 border-slate-200 hover:border-blue-500 hover:shadow-md transition-all p-0"
                  onClick={() => onSelectSubFormation(s.id, s.name)}
                >
                  <FormationThumbnail templateData={selectedFormation.templateData} side={selectedFormation.side} />
                  <div className="bg-[#1e40af] px-4 py-3 text-center">
                    <span className="font-semibold text-white uppercase tracking-wide">{s.name}</span>
                  </div>
                  <CardContent className="p-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{subFormationPlayCount(s.id)} plays</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Delete sub-formation "${s.name}"? Plays in this sub-formation will become uncategorized.`)) {
                            onDeleteSubFormation(s.id)
                          }
                        }}
                        title="Delete sub-formation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {uncategorizedCount > 0 && (
                <Card
                  className="cursor-pointer overflow-hidden border-2 border-dashed border-slate-300 hover:border-slate-400 transition-all p-0"
                  onClick={() => onSelectSubFormation(UNCATEGORIZED_ID, "Uncategorized")}
                >
                  <div className="aspect-[200/140] bg-slate-100 flex items-center justify-center">
                    <FileText className="h-12 w-12 text-slate-400" />
                  </div>
                  <div className="bg-slate-600 px-4 py-3 text-center">
                    <span className="font-semibold text-white">Uncategorized</span>
                  </div>
                  <CardContent className="p-2">
                    <span className="text-xs text-slate-500">Plays with no sub-formation ({uncategorizedCount})</span>
                  </CardContent>
                </Card>
              )}
            </div>
            {subFormationsForSelectedFormation.length === 0 && uncategorizedCount === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-slate-700 font-medium">No sub-formations yet</p>
                <p className="text-sm text-slate-500 mt-1">Create a sub-formation or add plays directly (they will appear under Uncategorized).</p>
                {canEdit && (
                  <Button size="sm" className="mt-4" onClick={() => onNewSubFormation(selectedFormation.id, selectedFormation.name, selectedFormation.side)}>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
