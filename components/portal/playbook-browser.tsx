"use client"

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

  const formationNames = useMemo(() => {
    const set = new Set<string>()
    plays.forEach((p) => p.formation?.trim() && set.add(p.formation.trim()))
    formations.forEach((f) => set.add(f.name.trim()))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [plays, formations])

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
    if (formationFilter) list = list.filter((p) => (p.formation?.trim() ?? "") === formationFilter)
    if (tagFilter) list = list.filter((p) => (p.subcategory?.trim() ?? "") === tagFilter)

    const sorted = [...list].sort((a, b) => {
      if (sortBy === "name") return (a.name ?? "").localeCompare(b.name ?? "")
      if (sortBy === "formation") return (a.formation ?? "").localeCompare(b.formation ?? "") || (a.name ?? "").localeCompare(b.name ?? "")
      return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    })
    return sorted
  }, [plays, search, sideFilter, formationFilter, tagFilter, sortBy])

  const playsByFormation = useMemo(() => {
    const map = new Map<string, PlayRecord[]>()
    filteredAndSortedPlays.forEach((p) => {
      const key = p.formation?.trim() || "Other"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    })
    const keys = Array.from(map.keys()).sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
    return { keys, map }
  }, [filteredAndSortedPlays])

  const canEditSide = (side: SideOfBall) => {
    if (side === "offense") return canEdit && canEditOffense
    if (side === "defense") return canEdit && canEditDefense
    return canEdit && canEditSpecialTeams
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar: search, filters, sort, actions */}
      <div className="flex-shrink-0 border-b border-border p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plays..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <select
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value as SideOfBall | "")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All sides</option>
            {SIDES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={formationFilter}
            onChange={(e) => setFormationFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[120px]"
          >
            <option value="">All formations</option>
            {formationNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[100px]"
          >
            <option value="">All tags</option>
            {tagNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="updated">Last updated</option>
            <option value="name">Name</option>
            <option value="formation">Formation</option>
          </select>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9"
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <div className="relative">
                <Button size="sm" onClick={() => { setNewPlayMenuOpen(!newPlayMenuOpen); setNewFormationMenuOpen(false); }}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Play
                </Button>
                {newPlayMenuOpen && (
                  <>
                    <div className="absolute left-0 top-full mt-1 z-20 py-1 rounded-md border border-border bg-popover shadow-lg min-w-[180px]">
                      <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">From side</p>
                      {SIDES.map((s) => (
                        <button
                          key={s.value}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
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
                          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground mt-2 border-t border-border">From formation</p>
                          {formations.slice(0, 8).map((f) => (
                            <button
                              key={f.id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted truncate"
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
                    <div className="absolute left-0 top-full mt-1 z-20 py-1 rounded-md border border-border bg-popover shadow-lg min-w-[140px]">
                      {SIDES.map((s) => (
                        <button
                          key={s.value}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
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

      {/* Main content: card grid or list, grouped by formation */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredAndSortedPlays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground font-medium">
              {plays.length === 0 ? "No plays yet" : "No plays match your filters"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
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
          <div className="space-y-8">
            {playsByFormation.keys.map((formationName) => {
              const sectionPlays = playsByFormation.map.get(formationName) ?? []
              return (
                <section key={formationName}>
                  <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="text-muted-foreground">{formationName}</span>
                    <span className="text-xs font-normal text-muted-foreground">({sectionPlays.length})</span>
                  </h2>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {sectionPlays.map((play) => (
                        <PlayCard
                          key={play.id}
                          play={play}
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
