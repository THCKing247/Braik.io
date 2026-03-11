"use client"

/**
 * Playbook browser: formations are first-class (from GET /api/formations).
 * Section headers and formation filter use only API formations so deleting all plays
 * does not remove any formation from the UI. Plays are grouped under formations by
 * formationId or by matching play.formation to formation.name; plays that match no
 * formation appear under "Other".
 */
import { useState, useMemo } from "react"
import { Search, Plus, LayoutGrid, List, Presentation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlayCard } from "@/components/portal/play-card"
import type { PlayRecord, FormationRecord, SideOfBall } from "@/types/playbook"

type ViewMode = "grid" | "list"
type SortKey = "name" | "updated" | "formation"

const SIDES: { value: SideOfBall; label: string }[] = [
  { value: "offense", label: "Offense" },
  { value: "defense", label: "Defense" },
  { value: "special_teams", label: "Special Teams" },
]

interface PlaybookBrowserProps {
  plays: PlayRecord[]
  formations: FormationRecord[]
  selectedPlayId: string | null
  onSelectPlay: (play: PlayRecord) => void
  onNewPlay: (side: SideOfBall, formationId: string | null, formationName: string) => void
  onNewFormation: (side: SideOfBall) => void
  onNewPlayFromFormation: (formation: FormationRecord) => void
  onDuplicatePlay: (playId: string) => void
  onRenamePlay: (playId: string, newName: string) => void
  onDeletePlay: (playId: string) => void
  onStartPlaycaller: () => void
  canEdit: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
}

export function PlaybookBrowser({
  plays,
  formations,
  selectedPlayId,
  onSelectPlay,
  onNewPlay,
  onNewFormation,
  onNewPlayFromFormation,
  onDuplicatePlay,
  onRenamePlay,
  onDeletePlay,
  onStartPlaycaller,
  canEdit,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
}: PlaybookBrowserProps) {
  const [search, setSearch] = useState("")
  const [sideFilter, setSideFilter] = useState<SideOfBall | "">("")
  const [formationFilter, setFormationFilter] = useState("")
  const [tagFilter, setTagFilter] = useState("")
  const [sortBy, setSortBy] = useState<SortKey>("updated")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [newPlayMenuOpen, setNewPlayMenuOpen] = useState(false)
  const [newFormationMenuOpen, setNewFormationMenuOpen] = useState(false)

  // Single source of truth: formation names from API only (so filter and sections stay consistent when plays are deleted)
  const formationNames = useMemo(() => {
    return [...formations].map((f) => f.name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [formations])

  const tagNames = useMemo(() => {
    const set = new Set<string>()
    plays.forEach((p) => p.subcategory?.trim() && set.add(p.subcategory.trim()))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [plays])

  const filteredAndSortedPlays = useMemo(() => {
    let list = plays
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.formation?.toLowerCase().includes(q)) ||
          (p.subcategory?.toLowerCase().includes(q))
      )
    }
    if (sideFilter) list = list.filter((p) => p.side === sideFilter)
    if (formationFilter) {
      const formationByName = formations.find((f) => f.name.trim() === formationFilter)
      list = list.filter((p) =>
        formationByName
          ? p.formationId === formationByName.id || (p.formation?.trim() ?? "") === formationFilter
          : (p.formation?.trim() ?? "") === formationFilter
      )
    }
    if (tagFilter) list = list.filter((p) => (p.subcategory?.trim() ?? "") === tagFilter)

    const sorted = [...list].sort((a, b) => {
      if (sortBy === "name") return (a.name ?? "").localeCompare(b.name ?? "")
      if (sortBy === "formation") return (a.formation ?? "").localeCompare(b.formation ?? "") || (a.name ?? "").localeCompare(b.name ?? "")
      return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    })
    return sorted
  }, [plays, search, sideFilter, formationFilter, tagFilter, sortBy])

  // Sections from formations API only (first-class). Plays grouped under formation by formationId or formation name match. "Other" for plays that match no formation.
  const formationsForSections = useMemo(() => {
    if (sideFilter) return formations.filter((f) => f.side === sideFilter)
    return formations
  }, [formations, sideFilter])

  const playsByFormationSection = useMemo(() => {
    const sections: { formation: FormationRecord | null; plays: PlayRecord[] }[] = []
    formationsForSections.forEach((formation) => {
      const sectionPlays = filteredAndSortedPlays.filter(
        (p) => p.formationId === formation.id || (p.formationId == null && (p.formation?.trim() ?? "") === formation.name)
      )
      sections.push({ formation, plays: sectionPlays })
    })
    const otherPlays = filteredAndSortedPlays.filter(
      (p) =>
        !formationsForSections.some(
          (f) => p.formationId === f.id || (p.formationId == null && (p.formation?.trim() ?? "") === f.name)
        )
    )
    if (otherPlays.length > 0) {
      sections.push({ formation: null, plays: otherPlays })
    }
    return sections
  }, [formationsForSections, filteredAndSortedPlays])

  const canEditSide = (side: SideOfBall) => {
    if (side === "offense") return canEdit && canEditOffense
    if (side === "defense") return canEdit && canEditDefense
    return canEdit && canEditSpecialTeams
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top bar: Row 1 = search + filters + sort; Row 2 = view toggle + actions */}
      <div className="flex-shrink-0 border-b border-slate-200 px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search plays..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 rounded-md border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400"
            />
          </div>
          <select
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value as SideOfBall | "")}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All sides</option>
            {SIDES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={formationFilter}
            onChange={(e) => setFormationFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 min-w-[110px]"
          >
            <option value="">All formations</option>
            {formationNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 min-w-[90px]"
          >
            <option value="">All tags</option>
            {tagNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="updated">Last updated</option>
            <option value="name">Name</option>
            <option value="formation">Formation</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              <div className="relative">
                <Button size="sm" onClick={() => { setNewPlayMenuOpen(!newPlayMenuOpen); setNewFormationMenuOpen(false); }}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Play
                </Button>
                {newPlayMenuOpen && (
                  <>
                    <div className="absolute left-0 top-full mt-1 z-20 py-1 rounded-lg border border-slate-200 bg-white shadow-lg min-w-[180px]">
                      <p className="px-3 py-1.5 text-xs font-medium text-slate-500">From side</p>
                      {SIDES.map((s) => (
                        <button
                          key={s.value}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            onNewPlay(s.value, null, "Custom")
                            setNewPlayMenuOpen(false)
                          }}
                        >
                          {s.label} (blank)
                        </button>
                      ))}
                      {formations.length > 0 && (
                        <>
                          <p className="px-3 py-1.5 text-xs font-medium text-slate-500 mt-2 border-t border-slate-200">From formation</p>
                          {formations.slice(0, 8).map((f) => (
                            <button
                              key={f.id}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 truncate"
                              onClick={() => {
                                onNewPlayFromFormation(f)
                                setNewPlayMenuOpen(false)
                              }}
                            >
                              {f.name} ({f.side.replace("_", " ")})
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="fixed inset-0 z-10" onClick={() => setNewPlayMenuOpen(false)} aria-hidden />
                  </>
                )}
              </div>
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => { setNewFormationMenuOpen(!newFormationMenuOpen); setNewPlayMenuOpen(false); }}>
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
                          onClick={() => {
                            onNewFormation(s.value)
                            setNewFormationMenuOpen(false)
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="fixed inset-0 z-10" onClick={() => setNewFormationMenuOpen(false)} aria-hidden />
                  </>
                )}
              </div>
            </>
          )}
          {plays.length > 0 && (
            <Button variant="outline" size="sm" onClick={onStartPlaycaller} title="Presentation mode">
              <Presentation className="h-4 w-4 mr-1" />
              Present
            </Button>
          )}
        </div>
      </div>

      {/* Main content: sections from formations API (first-class). Empty formations still show so delete-all-plays doesn't remove them. */}
      <div className="flex-1 overflow-y-auto p-4">
        {formationsForSections.length === 0 && filteredAndSortedPlays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-slate-700 font-medium">
              {plays.length === 0 ? "No plays or formations yet" : "No plays match your filters"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {plays.length === 0 ? "Create a formation or add a new play to get started." : "Try changing search or filters."}
            </p>
            {canEdit && plays.length === 0 && (
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => onNewPlay("offense", null, "Custom")}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Play
                </Button>
                <Button variant="outline" size="sm" onClick={() => onNewFormation("offense")}>
                  New Formation
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {playsByFormationSection.map(({ formation, plays: sectionPlays }) => {
              const sectionLabel = formation ? formation.name : "Other"
              const sectionKey = formation ? formation.id : "__other__"
              return (
                <section key={sectionKey}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
                    {sectionLabel}
                    <span className="text-slate-400 font-normal">({sectionPlays.length})</span>
                  </h2>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 gap-3">
                      {sectionPlays.map((play) => (
                        <PlayCard
                          key={play.id}
                          play={play}
                          formations={formations}
                          isSelected={selectedPlayId === play.id}
                          onOpen={onSelectPlay}
                          onDuplicate={onDuplicatePlay}
                          onRename={onRenamePlay}
                          onDelete={onDeletePlay}
                          canEdit={canEdit}
                          viewMode="grid"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sectionPlays.map((play) => (
                        <PlayCard
                          key={play.id}
                          play={play}
                          formations={formations}
                          isSelected={selectedPlayId === play.id}
                          onOpen={onSelectPlay}
                          onDuplicate={onDuplicatePlay}
                          onRename={onRenamePlay}
                          onDelete={onDeletePlay}
                          canEdit={canEdit}
                          viewMode="list"
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
