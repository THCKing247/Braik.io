"use client"

import { useState } from "react"
import { Pencil, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { PlayCardThumbnail } from "@/components/portal/play-card-thumbnail"
import { getPlayFormationDisplayName } from "@/lib/utils/playbook-formation"
import type { PlayRecord, FormationRecord } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"

interface PlayCardProps {
  play: PlayRecord
  /** When provided, formation name is resolved from the record (formationId-first); otherwise fallback to play.formation */
  formations?: FormationRecord[] | null
  isSelected?: boolean
  onOpen: (play: PlayRecord) => void
  onDuplicate: (playId: string) => void
  onRename: (playId: string, newName: string) => void
  onDelete: (playId: string) => void
  canEdit: boolean
  viewMode?: "grid" | "list"
}

function formatDate(s: string | undefined): string {
  if (!s) return "—"
  try {
    const d = new Date(s)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return "—"
  }
}

function sideLabel(side: string): string {
  if (side === "offense") return "Offense"
  if (side === "defense") return "Defense"
  return "Special Teams"
}

export function PlayCard({
  play,
  formations,
  isSelected,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
  canEdit,
  viewMode = "grid",
}: PlayCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(play.name)
  const formationDisplayName = getPlayFormationDisplayName(play, formations)

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== play.name) {
      onRename(play.id, trimmed)
    }
    setIsRenaming(false)
  }

  const canvasData = play.canvasData as PlayCanvasData | null

  if (viewMode === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(play)}
        onKeyDown={(e) => e.key === "Enter" && onOpen(play)}
        className={`
          flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
          hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300
          ${isSelected ? "ring-2 ring-blue-500 bg-blue-50/50 border-blue-200" : "border-slate-200 bg-white"}
        `}
      >
        <div className="w-20 h-14 flex-shrink-0 rounded-md overflow-hidden bg-[#2d5016]">
          <PlayCardThumbnail canvasData={canvasData} className="w-full h-full" />
        </div>
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit()
                if (e.key === "Escape") {
                  setRenameValue(play.name)
                  setIsRenaming(false)
                }
              }}
              className="h-8 text-sm font-medium"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="font-medium text-slate-800 truncate">{play.name}</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            {sideLabel(play.side)} · {formationDisplayName}
            {play.subcategory ? ` · ${play.subcategory}` : ""}
          </p>
        </div>
        <p className="text-xs text-slate-500 flex-shrink-0 hidden sm:block">{formatDate(play.updatedAt)}</p>
        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpen(play)} title="Open">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDuplicate(play.id)} title="Duplicate">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsRenaming(true)} title="Rename">
              <span className="text-xs">Rename</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => confirm("Delete this play?") && onDelete(play.id)} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card
      className={`
        cursor-pointer overflow-hidden transition-all border border-slate-200 bg-white
        hover:shadow-md hover:border-slate-300 focus-within:ring-2 focus-within:ring-slate-300
        ${isSelected ? "ring-2 ring-blue-500 border-blue-200 shadow-md" : ""}
      `}
      style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      onClick={() => onOpen(play)}
    >
      <div className="p-0">
        <PlayCardThumbnail canvasData={canvasData} className="w-full" />
      </div>
      <CardContent className="p-3">
        {isRenaming ? (
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit()
              if (e.key === "Escape") {
                setRenameValue(play.name)
                setIsRenaming(false)
              }
            }}
            className="h-8 text-sm font-medium border-slate-200"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="font-semibold text-slate-800 truncate" title={play.name}>
            {play.name}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          {sideLabel(play.side)} · {formationDisplayName}
        </p>
        {play.subcategory && (
          <p className="text-xs text-slate-500 truncate" title={play.subcategory}>
            {play.subcategory}
          </p>
        )}
        <p className="text-[10px] text-slate-400 mt-1">{formatDate(play.updatedAt)}</p>
      </CardContent>
      <CardFooter className="p-2 pt-0 flex flex-wrap gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
        {canEdit && (
          <>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpen(play)}>
              Open
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700" onClick={() => onDuplicate(play.id)} title="Duplicate">
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700" onClick={() => setIsRenaming(true)} title="Rename">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" onClick={() => confirm("Delete this play?") && onDelete(play.id)} title="Delete">
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
