"use client"

import { useState, useMemo } from "react"
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Trash2, Edit2, Copy, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FormationRecord, PlayRecord, SideOfBall } from "@/types/playbook"

export type PlaybookTreeFormation = {
  id: string | null
  name: string
  isSaved: boolean
  side: SideOfBall
}

interface PlaybookTreeProps {
  formations: FormationRecord[]
  plays: PlayRecord[]
  selectedFormationId: string | null
  selectedPlayId: string | null
  onSelectFormation: (formationId: string | null, formationName: string, side: SideOfBall) => void
  onSelectPlay: (play: PlayRecord) => void
  onNewFormation: (side: SideOfBall) => void
  onNewPlay: (side: SideOfBall, formationId: string | null, formationName: string, subcategory?: string | null) => void
  onNewSubFormation: (side: SideOfBall, formationName: string, subFormationName: string) => void
  onRenameFormation: (formationId: string, oldName: string, newName: string) => void
  onDeleteFormation: (formationId: string) => void
  onRenamePlay: (playId: string, newName: string) => void
  onDuplicatePlay: (playId: string) => void
  onDeletePlay: (playId: string) => void
  onEditFormation: (formation: FormationRecord) => void
  canEdit: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
}

const SIDES: { id: SideOfBall; label: string }[] = [
  { id: "offense", label: "Offense" },
  { id: "defense", label: "Defense" },
  { id: "special_teams", label: "Special Teams" },
]

export function PlaybookTree({
  formations,
  plays,
  selectedFormationId,
  selectedPlayId,
  onSelectFormation,
  onSelectPlay,
  onNewFormation,
  onNewPlay,
  onNewSubFormation,
  onRenameFormation,
  onDeleteFormation,
  onRenamePlay,
  onDuplicatePlay,
  onDeletePlay,
  onEditFormation,
  canEdit,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
}: PlaybookTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["offense", "defense", "special_teams"]))
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null)
  const [editingFormationId, setEditingFormationId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newSubFormation, setNewSubFormation] = useState<{ side: SideOfBall; formationName: string } | null>(null)
  const [newSubFormationName, setNewSubFormationName] = useState("")

  const canEditSide = (side: SideOfBall) => {
    if (side === "offense") return canEdit && canEditOffense
    if (side === "defense") return canEdit && canEditDefense
    return canEdit && canEditSpecialTeams
  }

  // Build per-side: list of formations (saved from API + unsaved names from plays), then plays under each
  const tree = useMemo(() => {
    const bySide: Record<SideOfBall, { formations: PlaybookTreeFormation[]; playsByFormation: Map<string, PlayRecord[]> }> = {
      offense: { formations: [], playsByFormation: new Map() },
      defense: { formations: [], playsByFormation: new Map() },
      special_teams: { formations: [], playsByFormation: new Map() },
    }

    for (const side of SIDES) {
      const s = side.id
      const apiFormations = formations.filter((f) => f.side === s)
      const playFormationNames = new Set(plays.filter((p) => p.side === s).map((p) => p.formation?.trim() || "Unnamed"))
      const formationNames = new Set<string>([...apiFormations.map((f) => f.name), ...playFormationNames])

      const list: PlaybookTreeFormation[] = []
      for (const name of Array.from(formationNames).sort((a, b) => (a === "Unnamed" ? 1 : b === "Unnamed" ? -1 : a.localeCompare(b)))) {
        const apiForm = apiFormations.find((f) => f.name === name)
        list.push({
          id: apiForm?.id ?? null,
          name,
          isSaved: !!apiForm,
          side: s,
        })
      }
      bySide[s].formations = list

      for (const play of plays.filter((p) => p.side === s)) {
        const key = play.formation?.trim() || "Unnamed"
        if (!bySide[s].playsByFormation.has(key)) {
          bySide[s].playsByFormation.set(key, [])
        }
        bySide[s].playsByFormation.get(key)!.push(play)
      }
    }
    return bySide
  }, [formations, plays])

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSavePlayRename = (playId: string) => {
    if (editValue.trim()) {
      onRenamePlay(playId, editValue.trim())
    }
    setEditingPlayId(null)
    setEditValue("")
  }

  const handleSaveFormationRename = (formationId: string, oldName: string) => {
    if (editValue.trim()) {
      onRenameFormation(formationId, oldName, editValue.trim())
    }
    setEditingFormationId(null)
    setEditValue("")
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-3 bg-background border-r border-border">
      <div className="space-y-1 min-w-0">
        {SIDES.map(({ id: side, label }) => {
          const isExpanded = expanded.has(side)
          const canEditThis = canEditSide(side)
          const { formations: sideFormations, playsByFormation } = tree[side]

          return (
            <div key={side} className="mb-2 min-w-0">
              <div
                className="flex items-center gap-1 py-2 px-2 rounded-md font-semibold cursor-pointer hover:bg-muted/60"
                onClick={() => toggle(side)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <span className="text-sm uppercase tracking-wide flex-1 min-w-0 truncate text-foreground">
                  {label}
                </span>
                {canEditThis && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-70 hover:opacity-100 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNewFormation(side)
                    }}
                    title="New Formation"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {isExpanded && (
                <div className="ml-4 min-w-0">
                  {sideFormations.length === 0 && (
                    <div className="text-xs text-muted-foreground py-2 italic">No formations yet</div>
                  )}
                  {sideFormations.map((form) => {
                    const formKey = form.id ?? `name:${form.name}`
                    const formExpanded = expanded.has(formKey)
                    const formPlays = playsByFormation.get(form.name) ?? []
                    const isEditingForm = editingFormationId === form.id
                    const isAddingSub = newSubFormation?.side === side && newSubFormation?.formationName === form.name

                    return (
                      <div key={formKey} className="ml-2 mt-1 min-w-0">
                        <div
                          className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-muted/50 cursor-pointer group"
                          onClick={() => !isEditingForm && toggle(formKey)}
                        >
                          {formExpanded ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          )}
                          <Folder className="h-4 w-4 flex-shrink-0 text-primary" />
                          {isEditingForm && form.id ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveFormationRename(form.id!, form.name)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveFormationRename(form.id!, form.name)
                                if (e.key === "Escape") {
                                  setEditingFormationId(null)
                                  setEditValue("")
                                }
                              }}
                              className="flex-1 min-w-0 h-7 text-sm"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <span className="text-sm font-medium flex-1 min-w-0 truncate text-foreground">
                                {form.name}
                              </span>
                              {form.isSaved && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">saved</span>
                              )}
                              {canEditThis && (
                                <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
                                  {form.id && form.isSaved && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0"
                                        title="Edit formation (alignment)"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const f = formations.find((x) => x.id === form.id)
                                          if (f) onEditFormation(f)
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0"
                                        title="Rename formation"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingFormationId(form.id)
                                          setEditValue(form.name)
                                        }}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 text-destructive"
                                        title="Delete formation"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (confirm(`Delete formation "${form.name}"?`)) onDeleteFormation(form.id!)
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    title="New sub-formation / tag"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setNewSubFormation({ side, formationName: form.name })
                                    }}
                                  >
                                    <Folder className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    title="New play"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onNewPlay(side, form.id, form.name, null)
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {formExpanded && (
                          <div className="ml-4 min-w-0">
                            {isAddingSub && (
                              <div className="py-2 flex flex-col gap-2">
                                <Input
                                  value={newSubFormationName}
                                  onChange={(e) => setNewSubFormationName(e.target.value)}
                                  placeholder="Sub-formation name..."
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      onNewSubFormation(side, form.name, newSubFormationName.trim())
                                      setNewSubFormation(null)
                                      setNewSubFormationName("")
                                    }
                                    if (e.key === "Escape") {
                                      setNewSubFormation(null)
                                      setNewSubFormationName("")
                                    }
                                  }}
                                  className="h-8 text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      onNewSubFormation(side, form.name, newSubFormationName.trim())
                                      setNewSubFormation(null)
                                      setNewSubFormationName("")
                                    }}
                                    disabled={!newSubFormationName.trim()}
                                  >
                                    Create
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setNewSubFormation(null); setNewSubFormationName("") }}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                            {formPlays.map((play) => (
                              <div
                                key={play.id}
                                className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer group min-w-0 ${
                                  selectedPlayId === play.id ? "bg-primary/10" : "hover:bg-muted/50"
                                }`}
                                onClick={() => onSelectPlay(play)}
                              >
                                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                {editingPlayId === play.id ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => handleSavePlayRename(play.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSavePlayRename(play.id)
                                      if (e.key === "Escape") {
                                        setEditingPlayId(null)
                                        setEditValue("")
                                      }
                                    }}
                                    className="flex-1 min-w-0 h-7 text-sm"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <>
                                    <span className="text-sm flex-1 min-w-0 truncate text-foreground">{play.name}</span>
                                    {canEditThis && (
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingPlayId(play.id)
                                            setEditValue(play.name)
                                          }}
                                          title="Rename"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            onDuplicatePlay(play.id)
                                          }}
                                          title="Duplicate"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (confirm("Delete this play?")) onDeletePlay(play.id)
                                          }}
                                          title="Delete"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                            {formPlays.length === 0 && !isAddingSub && (
                              <div className="text-xs text-muted-foreground py-2 italic ml-2">No plays yet</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
