"use client"

import { useState, useMemo } from "react"
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Play {
  id: string
  side: string
  formation: string
  subcategory: string | null
  name: string
  createdAt?: Date
}

interface PlaybookFileTreeProps {
  plays: Play[]
  selectedPlayId: string | null
  onSelectPlay: (playId: string) => void
  onNewPlay: (side: string, formation: string, subcategory?: string | null) => void
  onNewFormation: (side: string, formationName: string) => void
  onNewSubFormation: (side: string, formation: string, subFormationName: string) => void
  onDeletePlay: (playId: string) => void
  onRenamePlay: (playId: string, newName: string) => void
  onRenameFormation: (side: string, oldFormation: string, newFormation: string) => void
  canEdit: boolean
  pendingFormations?: Array<{ side: string; formation: string }>
}

export function PlaybookFileTree({
  plays,
  selectedPlayId,
  onSelectPlay,
  onNewPlay,
  onNewFormation,
  onNewSubFormation,
  onDeletePlay,
  onRenamePlay,
  onRenameFormation,
  canEdit,
  pendingFormations = [],
}: PlaybookFileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["offense", "defense", "special_teams"]))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingFormation, setEditingFormation] = useState<{ side: string; formation: string } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newFormationSide, setNewFormationSide] = useState<string | null>(null)
  const [newFormationName, setNewFormationName] = useState("")
  const [newSubFormation, setNewSubFormation] = useState<{ side: string; formation: string } | null>(null)
  const [newSubFormationName, setNewSubFormationName] = useState("")

  // Organize plays by hierarchy: side -> formation -> subcategory -> plays
  // Also include pending formations (created but not yet saved with plays)
  const organized = useMemo(() => {
    const structure: Record<string, Record<string, Record<string, Play[]>>> = {
      offense: {},
      defense: {},
      special_teams: {},
    }
    const subKey = (s: string | null) => s ?? "null"

    plays.forEach((play) => {
      const side = play.side || "offense"
      const formation = play.formation || "Unnamed"
      const subcategory = play.subcategory || null
      const key = subKey(subcategory)

      if (!structure[side]) structure[side] = {}
      if (!structure[side][formation]) structure[side][formation] = {}
      if (!structure[side][formation][key]) structure[side][formation][key] = []

      structure[side][formation][key].push(play)
    })

    // Add pending formations (formations created but not yet saved with plays)
    pendingFormations.forEach(({ side, formation }) => {
      if (!structure[side]) structure[side] = {}
      if (!structure[side][formation]) {
        structure[side][formation] = {}
        structure[side][formation]["null"] = [] // Empty array for plays directly under formation
      }
    })

    return structure
  }, [plays, pendingFormations])

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpanded(newExpanded)
  }

  const handleRename = (playId: string, currentName: string) => {
    setEditingId(playId)
    setEditValue(currentName)
  }

  const saveRename = (playId: string) => {
    if (editValue.trim()) {
      onRenamePlay(playId, editValue.trim())
    }
    setEditingId(null)
    setEditValue("")
  }

  const saveFormationRename = () => {
    if (editingFormation && editValue.trim()) {
      onRenameFormation(editingFormation.side, editingFormation.formation, editValue.trim())
    }
    setEditingFormation(null)
    setEditValue("")
  }

  const handleNewFormation = (side: string) => {
    setNewFormationSide(side)
    setNewFormationName("")
  }

  const createNewFormation = () => {
    if (newFormationSide && newFormationName.trim()) {
      onNewFormation(newFormationSide, newFormationName.trim())
      setNewFormationSide(null)
      setNewFormationName("")
    }
  }

  const handleNewSubFormation = (side: string, formation: string) => {
    setNewSubFormation({ side, formation })
    setNewSubFormationName("")
  }

  const createNewSubFormation = () => {
    if (newSubFormation && newSubFormationName.trim()) {
      onNewSubFormation(newSubFormation.side, newSubFormation.formation, newSubFormationName.trim())
      setNewSubFormation(null)
      setNewSubFormationName("")
    }
  }

  const renderSubFormation = (side: string, formation: string, subcategory: string | null, subFormationPlays: Play[]) => {
    const subFormationPath = `${side}/${formation}/${subcategory || "none"}`
    const isExpanded = expanded.has(subFormationPath)
    const isCreatingSubFormation = newSubFormation?.side === side && newSubFormation?.formation === formation

    // If subcategory is null, these are plays directly under the formation
    if (subcategory === null) {
      return (
        <div key={subFormationPath} className="min-w-0">
          {subFormationPlays.map((play) => (
            <div
              key={play.id}
              className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer group min-w-0 ${
                selectedPlayId === play.id ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
              onClick={() => onSelectPlay(play.id)}
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />
              {editingId === play.id ? (
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveRename(play.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(play.id)
                    if (e.key === "Escape") {
                      setEditingId(null)
                      setEditValue("")
                    }
                  }}
                  className="flex-1 min-w-0"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "rgb(var(--text))" }}>
                    {play.name}
                  </span>
                  {canEdit && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRename(play.id, play.name)
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm("Delete this play?")) {
                            onDeletePlay(play.id)
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {canEdit && subFormationPlays.length === 0 && (
            <div className="ml-6 text-xs text-gray-400 py-2 italic">
              No plays yet
            </div>
          )}
        </div>
      )
    }

    // Sub-formation (subcategory exists)
    return (
      <div key={subFormationPath} className="ml-4 min-w-0">
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer group"
          onClick={() => toggleExpand(subFormationPath)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "#0B2A5B" }} />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "#0B2A5B" }} />
          )}
          <Folder className="h-4 w-4 flex-shrink-0" style={{ color: "#3B82F6" }} />
          <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: "rgb(var(--text))" }}>
            {subcategory}
          </span>
          {canEdit && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onNewPlay(side, formation, subcategory)
                }}
                title="New Play"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {isExpanded && (
          <div className="ml-8 border-l-2 pl-2 min-w-0" style={{ borderLeftColor: "#E5E7EB" }}>
            {subFormationPlays.map((play) => (
              <div
                key={play.id}
                className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer group min-w-0 ${
                  selectedPlayId === play.id ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
                onClick={() => onSelectPlay(play.id)}
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />
                {editingId === play.id ? (
                  <Input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveRename(play.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(play.id)
                      if (e.key === "Escape") {
                        setEditingId(null)
                        setEditValue("")
                      }
                    }}
                    className="flex-1 min-w-0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "rgb(var(--text))" }}>
                      {play.name}
                    </span>
                    {canEdit && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRename(play.id, play.name)
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm("Delete this play?")) {
                              onDeletePlay(play.id)
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {subFormationPlays.length === 0 && (
              <div className="ml-6 text-xs text-gray-400 py-2 italic">
                No plays in this sub-formation
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderFormation = (side: string, formation: string, formationData: Record<string, Play[]>) => {
    const formationPath = `${side}/${formation}`
    const isExpanded = expanded.has(formationPath)
    const isEditing = editingFormation?.side === side && editingFormation?.formation === formation
    const isCreatingSubFormation = newSubFormation?.side === side && newSubFormation?.formation === formation

    // Get all subcategories (including null for plays directly under formation)
    const subcategories = Object.keys(formationData).sort((a, b) => {
      if (a === "null") return 1 // null subcategory last
      if (b === "null") return -1
      return a.localeCompare(b)
    })

    return (
      <div key={formationPath} className="ml-4 min-w-0">
        <div
          className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-gray-100 cursor-pointer group"
          onClick={() => !isEditing && toggleExpand(formationPath)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "#0B2A5B" }} />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "#0B2A5B" }} />
          )}
          <Folder className="h-4 w-4 flex-shrink-0" style={{ color: "#3B82F6" }} />
          {isEditing ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveFormationRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveFormationRename()
                if (e.key === "Escape") {
                  setEditingFormation(null)
                  setEditValue("")
                }
              }}
              className="flex-1 min-w-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: "rgb(var(--text))" }}>
                {formation}
              </span>
              {canEdit && (
                <div className="flex gap-0.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 hover:bg-gray-100 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNewSubFormation(side, formation)
                    }}
                    title="New Sub-Formation"
                  >
                    <Folder className="h-3.5 w-3.5" style={{ color: "#3B82F6" }} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 hover:bg-gray-100 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNewPlay(side, formation, null)
                    }}
                    title="New Play"
                  >
                    <Plus className="h-3.5 w-3.5" style={{ color: "#0B2A5B" }} />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {isExpanded && (
          <div className="ml-6 min-w-0">
            {isCreatingSubFormation && (
              <div className="ml-4 py-2 min-w-0">
                <div className="flex flex-col gap-2 w-full max-w-full">
                  <Input
                    value={newSubFormationName}
                    onChange={(e) => setNewSubFormationName(e.target.value)}
                    placeholder="Sub-formation name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createNewSubFormation()
                      if (e.key === "Escape") {
                        setNewSubFormation(null)
                        setNewSubFormationName("")
                      }
                    }}
                    autoFocus
                    className="w-full"
                  />
                  <div className="flex gap-2 w-full">
                    <Button
                      size="sm"
                      onClick={createNewSubFormation}
                      disabled={!newSubFormationName.trim()}
                      className="flex-1"
                    >
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewSubFormation(null)
                        setNewSubFormationName("")
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {subcategories.map((subcategoryKey) => {
              const subcategory = subcategoryKey === "null" ? null : subcategoryKey
              return renderSubFormation(side, formation, subcategory, formationData[subcategoryKey] || [])
            })}
            {subcategories.length === 0 && !isCreatingSubFormation && (
              <div className="ml-6 text-xs text-gray-400 py-2 italic">
                No plays yet
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderSide = (side: string, label: string) => {
    const sidePath = side
    const isExpanded = expanded.has(sidePath)
    const formations = organized[side] || {}
    const isCreatingFormation = newFormationSide === side

    return (
      <div key={side} className="mb-2 min-w-0">
        <div
          className="flex items-center gap-1 py-2 px-2 rounded font-semibold cursor-pointer hover:bg-gray-50 group"
          onClick={() => toggleExpand(sidePath)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "#0B2A5B" }} />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "#0B2A5B" }} />
          )}
          <span className="text-sm uppercase tracking-wide flex-1 min-w-0 truncate" style={{ color: "#0B2A5B" }}>
            {label}
          </span>
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                handleNewFormation(side)
              }}
              title="New Formation"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
        {isExpanded && (
          <div className="min-w-0">
            {Object.entries(formations).map(([formation, formationData]) =>
              renderFormation(side, formation, formationData)
            )}
            {isCreatingFormation && (
              <div className="ml-6 py-2 min-w-0">
                <div className="flex flex-col gap-2 w-full max-w-full">
                  <Input
                    value={newFormationName}
                    onChange={(e) => setNewFormationName(e.target.value)}
                    placeholder="Formation name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createNewFormation()
                      if (e.key === "Escape") {
                        setNewFormationSide(null)
                        setNewFormationName("")
                      }
                    }}
                    autoFocus
                    className="w-full"
                  />
                  <div className="flex gap-2 w-full">
                    <Button
                      size="sm"
                      onClick={createNewFormation}
                      disabled={!newFormationName.trim()}
                      className="flex-1"
                    >
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewFormationSide(null)
                        setNewFormationName("")
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {Object.keys(formations).length === 0 && !isCreatingFormation && (
              <div className="ml-6 text-xs text-gray-400 py-2">
                No plays yet
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-4" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="space-y-1 min-w-0">
        {renderSide("offense", "Offense")}
        {renderSide("defense", "Defense")}
        {renderSide("special_teams", "Special Teams")}
      </div>
    </div>
  )
}
