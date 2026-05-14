"use client"

import { useState } from "react"
import { DepthSlotCard } from "./depth-slot-card"
import type { RosterPlayerForSlot } from "@/lib/depth-chart/player-resolve"

interface PositionColumnProps {
  position: string
  positionLabel: string
  /** Optional secondary line (e.g. position group "WR", "LB") shown below primary when slot uses a coach alias. */
  secondaryLabel?: string | null
  /** Optional hint for empty slot (e.g. "Best fits: WR, Athlete"). Shown when starter is empty. */
  emptySlotHint?: string | null
  players: Array<{ player: RosterPlayerForSlot; string: number }>
  canEdit: boolean
  /** When null: not dragging. When true: best-fit slot for dragged player. When false: position mismatch — drops are still allowed; amber styling is advisory only. */
  isSlotValidForDrop?: boolean | null
  /** Called when drag starts from an assigned slot (roster or slot); used to show best-fit vs mismatch slot guidance. */
  onDragStartPlayer?: (playerId: string) => void
  onDrop?: (position: string, string: number, playerId: string) => void
  onRemove?: (position: string, string: number) => void
  onReorder?: (position: string, fromString: number, toString: number) => void
}

export function PositionColumn({
  position,
  positionLabel,
  secondaryLabel,
  emptySlotHint,
  players,
  canEdit,
  isSlotValidForDrop = null,
  onDragStartPlayer,
  onDrop,
  onRemove,
  onReorder,
}: PositionColumnProps) {
  const [dragOverString, setDragOverString] = useState<number | null>(null)
  const isPositionMismatch = isSlotValidForDrop === false
  const isDragging = isSlotValidForDrop !== null

  const starter = players.find((p) => p.string === 1)
  const secondString = players.find((p) => p.string === 2)
  const thirdString = players.find((p) => p.string === 3)
  const moreCount = players.filter((p) => p.string > 3).length

  const handleDrop = (e: React.DragEvent, targetString: number) => {
    e.preventDefault()
    const playerId = e.dataTransfer.getData("playerId")
    const sourceString = e.dataTransfer.getData("sourceString")

    if (playerId) {
      if (sourceString && onReorder) {
        onReorder(position, parseInt(sourceString, 10), targetString)
      } else if (onDrop) {
        onDrop(position, targetString, playerId)
      }
    }
    setDragOverString(null)
  }

  const handleSlotDragStart = (playerId: string) => {
    onDragStartPlayer?.(playerId)
  }

  const handlePromote = (fromString: number) => {
    if (onReorder) onReorder(position, fromString, 1)
  }

  const columnRingClass = isDragging
    ? isPositionMismatch
      ? "ring-2 ring-amber-500/45 ring-offset-2 ring-offset-background rounded-xl"
      : "ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-xl"
    : ""

  const dropZoneClass = (stringNum: number, minH: string) => {
    const over = dragOverString === stringNum
    const base = `rounded-xl border-2 border-dashed transition-all duration-200 ${minH} shrink-0 box-border`
    if (!isDragging) {
      return `${base} border-transparent bg-transparent`
    }
    if (isPositionMismatch) {
      if (over) {
        return `${base} border-amber-500 bg-amber-500/12 ring-2 ring-amber-500/30`
      }
      return `${base} border-amber-500/40 bg-amber-500/[0.06]`
    }
    if (over) {
      return `${base} border-primary bg-primary/10 ring-2 ring-primary/20`
    }
    return `${base} border-transparent bg-transparent`
  }

  const emptyStarterClass =
    "w-full h-[104px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 py-2 px-2 shrink-0 transition-colors duration-200 " +
    (isPositionMismatch && isDragging
      ? "border-amber-500/45 bg-amber-500/[0.07] text-muted-foreground"
      : isDragging && !isPositionMismatch
        ? "border-primary/25 bg-primary/[0.04] text-muted-foreground"
        : "border-slate-300/80 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300")

  const emptyBenchClass = (label: string) =>
    `w-full rounded-xl border-2 border-dashed flex items-center justify-center shrink-0 transition-colors duration-200 ${
      label === "2nd" ? "h-[76px]" : "h-[64px]"
    } ` +
    (isPositionMismatch && isDragging
      ? "border-amber-500/40 bg-amber-500/[0.05] text-muted-foreground/80"
      : isDragging && !isPositionMismatch
        ? "border-primary/20 bg-primary/[0.03] text-muted-foreground"
        : "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/35 text-slate-500 dark:text-slate-400")

  return (
    <div className={`flex flex-col h-full min-w-[120px] ${columnRingClass}`}>
      <div className="text-center py-1.5 mb-2">
        <div className="text-sm font-semibold tracking-tight text-foreground">
          {positionLabel}
        </div>
        {secondaryLabel && (
          <div className="text-[11px] mt-0.5 font-normal normal-case text-muted-foreground">
            {secondaryLabel}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2.5">
        {/* Starter (1st String) */}
        <div
          className="h-[104px] shrink-0"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverString(1)
          }}
          onDragLeave={() => setDragOverString(null)}
          onDrop={(e) => handleDrop(e, 1)}
        >
          <div className={dropZoneClass(1, "h-full")}>
            {starter ? (
              <DepthSlotCard
                player={starter.player}
                depthLevel={1}
                canEdit={canEdit}
                onRemove={onRemove ? () => onRemove(position, 1) : undefined}
                draggable={canEdit}
                onDragStart={(e) => {
                  e.dataTransfer.setData("playerId", starter.player.id)
                  e.dataTransfer.setData("sourceString", "1")
                  e.dataTransfer.effectAllowed = "move"
                  handleSlotDragStart(starter.player.id)
                }}
              />
            ) : (
              <div className={emptyStarterClass}>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Open slot
                </span>
                {emptySlotHint && (
                  <span className="text-[11px] text-center px-1 max-w-full leading-snug text-muted-foreground/90">
                    {emptySlotHint}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2nd String */}
        <div
          className="h-[76px] shrink-0"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverString(2)
          }}
          onDragLeave={() => setDragOverString(null)}
          onDrop={(e) => handleDrop(e, 2)}
        >
          <div className={dropZoneClass(2, "h-full")}>
            {secondString ? (
              <DepthSlotCard
                player={secondString.player}
                depthLevel={2}
                canEdit={canEdit}
                onPromote={canEdit ? () => handlePromote(2) : undefined}
                onRemove={onRemove ? () => onRemove(position, 2) : undefined}
                draggable={canEdit}
                onDragStart={(e) => {
                  e.dataTransfer.setData("playerId", secondString.player.id)
                  e.dataTransfer.setData("sourceString", "2")
                  e.dataTransfer.effectAllowed = "move"
                  handleSlotDragStart(secondString.player.id)
                }}
              />
            ) : (
              <div className={emptyBenchClass("2nd")}>
                <span className="text-[11px] font-semibold tracking-wide">2nd string</span>
              </div>
            )}
          </div>
        </div>

        {/* 3rd String */}
        <div
          className="h-[64px] shrink-0"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverString(3)
          }}
          onDragLeave={() => setDragOverString(null)}
          onDrop={(e) => handleDrop(e, 3)}
        >
          <div className={dropZoneClass(3, "h-full")}>
            {thirdString ? (
              <DepthSlotCard
                player={thirdString.player}
                depthLevel={3}
                canEdit={canEdit}
                onPromote={canEdit ? () => handlePromote(3) : undefined}
                onRemove={onRemove ? () => onRemove(position, 3) : undefined}
                draggable={canEdit}
                onDragStart={(e) => {
                  e.dataTransfer.setData("playerId", thirdString.player.id)
                  e.dataTransfer.setData("sourceString", "3")
                  e.dataTransfer.effectAllowed = "move"
                  handleSlotDragStart(thirdString.player.id)
                }}
              />
            ) : (
              <div className={emptyBenchClass("3rd")}>
                <span className="text-[11px] font-semibold tracking-wide">3rd string</span>
              </div>
            )}
          </div>
        </div>

        {moreCount > 0 && (
          <div className="text-xs text-center py-1.5 px-2 rounded-lg border border-border bg-muted/40 text-foreground">
            +{moreCount} more
          </div>
        )}
      </div>
    </div>
  )
}
