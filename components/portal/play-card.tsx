"use client"

import { useState } from "react"
import { Pencil, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { PlayCardThumbnail } from "@/components/portal/play-card-thumbnail"
import { getPlayFormationDisplayName } from "@/lib/utils/playbook-formation"
import { type DepthChartSlot } from "@/lib/constants/playbook-positions"
import { getAssignmentSummary, getAssignmentStatus, type AssignmentStatus } from "@/lib/utils/playbook-assignment"
import type { PlayRecord, FormationRecord, PlayType } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"

interface PlayCardProps {
  play: PlayRecord
  formations?: FormationRecord[] | null
  depthChartEntries?: DepthChartSlot[] | null
  isSelected?: boolean
  onOpen: (play: PlayRecord) => void
  onDuplicate: (playId: string) => void
  onRename: (playId: string, newName: string) => void
  onDelete: (playId: string) => void
  canEdit: boolean
  viewMode?: "grid" | "list"
  onReviewAssignments?: (play: PlayRecord) => void
  /** When set, "Open" opens this URL (e.g. in new tab) instead of calling onOpen. */
  playEditorPath?: (playId: string) => string
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

const PLAY_TYPE_STYLE: Record<PlayType, { bg: string; label: string }> = {
  run: { bg: "bg-red-600", label: "RUN" },
  pass: { bg: "bg-blue-600", label: "PASS" },
  rpo: { bg: "bg-amber-600", label: "RPO" },
  screen: { bg: "bg-emerald-600", label: "SCREEN" },
}

function PlayTypeBadge({ playType }: { playType: PlayType | null }) {
  if (!playType || !PLAY_TYPE_STYLE[playType]) return null
  const { bg, label } = PLAY_TYPE_STYLE[playType]
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold text-white uppercase tracking-wide shadow-md ${bg}`}>
      {label}
    </span>
  )
}

function AssignmentBadge({ status }: { status: AssignmentStatus }) {
  if (status === "none") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500">
        No role markers
      </span>
    )
  }
  if (status === "complete") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700">
        Complete
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700">
      Incomplete
    </span>
  )
}

export function PlayCard({
  play,
  formations,
  depthChartEntries,
  isSelected,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
  canEdit,
  viewMode = "grid",
  onReviewAssignments,
  playEditorPath,
}: PlayCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(play.name)
  const formationDisplayName = getPlayFormationDisplayName(play, formations)
  const assignmentSummary = getAssignmentSummary(play, depthChartEntries)
  const assignmentStatus = getAssignmentStatus(play, depthChartEntries)

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== play.name) {
      onRename(play.id, trimmed)
    }
    setIsRenaming(false)
  }

  const handleOpen = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (playEditorPath) {
      const path = playEditorPath(play.id)
      window.open(path, "_blank", "noopener,noreferrer")
    } else {
      onOpen(play)
    }
  }

  const canvasData = play.canvasData as PlayCanvasData | null

  if (viewMode === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => (playEditorPath ? handleOpen() : onOpen(play))}
        onKeyDown={(e) => e.key === "Enter" && (playEditorPath ? handleOpen() : onOpen(play))}
        className={`
          flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
          hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300
          ${isSelected ? "ring-2 ring-blue-500 bg-blue-50/50 border-blue-200" : "border-slate-200 bg-white"}
        `}
      >
        <div className="w-20 h-14 flex-shrink-0 rounded-md overflow-hidden bg-[#2d5016] relative">
          <PlayCardThumbnail canvasData={canvasData} className="w-full h-full" />
          <div className="absolute top-0.5 left-0.5">
            <PlayTypeBadge playType={play.playType ?? null} />
          </div>
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
            {play.subFormation ? ` · ${play.subFormation}` : play.subcategory ? ` · ${play.subcategory}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <AssignmentBadge status={assignmentStatus} />
            {assignmentSummary && assignmentSummary.total > 0 && (
              <span className="text-[10px] text-slate-500">
                {assignmentSummary.assigned}/{assignmentSummary.total} assigned
                {assignmentSummary.assigned < assignmentSummary.total && (
                  <span className="text-amber-600"> · {assignmentSummary.total - assignmentSummary.assigned} unassigned</span>
                )}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 flex-shrink-0 hidden sm:block">{formatDate(play.updatedAt)}</p>
        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {assignmentStatus === "incomplete" && onReviewAssignments && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-700 hover:text-amber-800" onClick={() => onReviewAssignments(play)} title="Review assignments">
                Review
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen} title="Open">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onDuplicate(play.id); }} title="Duplicate">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }} title="Rename">
              <span className="text-xs">Rename</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); confirm("Delete this play?") && onDelete(play.id); }} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Grid: preview-dominant, strong blue footer, clear actions (Open > Review > icons)
  return (
    <Card
      className={`
        cursor-pointer overflow-hidden transition-all border-2 border-slate-200 bg-white
        hover:shadow-xl hover:border-blue-400 hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-blue-300
        ${isSelected ? "ring-2 ring-blue-500 border-blue-500 shadow-lg" : ""}
      `}
      onClick={handleOpen}
    >
      {/* Preview: main focus — thumbnail fills top, rounded-t only (footer connects cleanly) */}
      <div className="relative">
        <PlayCardThumbnail canvasData={canvasData} className="w-full aspect-[200/140] flex-shrink-0" />
        <div className="absolute top-2 left-2 z-10 shadow-md">
          <PlayTypeBadge playType={play.playType ?? null} />
        </div>
        {assignmentSummary && assignmentSummary.total > 0 && (
          <div className="absolute bottom-2 right-2 z-10 text-[10px] font-medium text-white/95 bg-black/50 backdrop-blur-sm rounded-md px-2 py-1">
            {assignmentSummary.assigned}/{assignmentSummary.total}
            {assignmentSummary.assigned < assignmentSummary.total && (
              <span className="text-amber-300 ml-0.5">({assignmentSummary.total - assignmentSummary.assigned} open)</span>
            )}
          </div>
        )}
      </div>
      {/* Blue footer: play name primary, sub-formation secondary */}
      <div className="bg-[#1e40af] px-4 py-3.5 flex-shrink-0">
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
            className="h-8 text-sm font-bold text-white bg-white/20 border-white/40 placeholder:text-white/70"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <p className="font-bold text-white text-center truncate text-base" title={play.name}>
              {play.name}
            </p>
            {play.subFormation && (
              <p className="text-xs text-white/80 text-center mt-0.5 truncate">
                {play.subFormation}
              </p>
            )}
          </>
        )}
      </div>
      {/* Actions: Open primary, Review when needed, then icon row — no clutter */}
      <CardFooter className="p-2.5 flex items-center justify-between gap-2 bg-slate-50/95 border-t border-slate-200 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {canEdit ? (
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Button variant="default" size="sm" className="h-8 px-3 text-xs font-semibold bg-[#1e40af] hover:bg-[#1e3a8a] shrink-0" onClick={handleOpen}>
              Open
            </Button>
            {assignmentStatus === "incomplete" && onReviewAssignments && (
              <Button variant="secondary" size="sm" className="h-8 px-2.5 text-xs text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100 shrink-0" onClick={() => onReviewAssignments(play)}>
                Review
              </Button>
            )}
            <div className="flex items-center gap-0.5 ml-auto shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700" onClick={() => onDuplicate(play.id)} title="Duplicate">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700" onClick={() => setIsRenaming(true)} title="Rename">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => confirm("Delete this play?") && onDelete(play.id)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="default" size="sm" className="h-8 px-3 text-xs font-semibold bg-[#1e40af] hover:bg-[#1e3a8a]" onClick={handleOpen}>
            Open
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
