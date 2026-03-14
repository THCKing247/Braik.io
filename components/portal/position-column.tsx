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
  /** When null: not dragging. When boolean: true = valid drop target, false = dimmed (invalid for dragged player). */
  isSlotValidForDrop?: boolean | null
  /** Called when drag starts from an assigned slot (roster or slot); used to show valid/invalid slot guidance. */
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
  const [draggedString, setDraggedString] = useState<number | null>(null)
  const isDimmed = isSlotValidForDrop === false

  const starter = players.find((p) => p.string === 1)
  const secondString = players.find((p) => p.string === 2)
  const thirdString = players.find((p) => p.string === 3)
  const moreCount = players.filter((p) => p.string > 3).length

  const handleDrop = (e: React.DragEvent, targetString: number) => {
    e.preventDefault()
    const playerId = e.dataTransfer.getData("playerId")
    const sourceString = e.dataTransfer.getData("sourceString")

    if (playerId && onDrop) {
      if (sourceString && onReorder) {
        onReorder(position, parseInt(sourceString, 10), targetString)
      } else {
        onDrop(position, targetString, playerId)
      }
    }
    setDragOverString(null)
    setDraggedString(null)
  }

  const handleSlotDragStart = (playerId: string, stringNum: number) => {
    onDragStartPlayer?.(playerId)
    setDraggedString(stringNum)
  }

  const handlePromote = (fromString: number) => {
    if (onReorder) onReorder(position, fromString, 1)
  }

  const dropZoneStyle = (stringNum: number) => ({
    backgroundColor:
      dragOverString === stringNum && !isDimmed ? "rgba(37, 99, 235, 0.1)" : "transparent",
    borderRadius: "4px",
    transition: "background-color 0.2s",
    border: dragOverString === stringNum && !isDimmed ? "2px dashed rgb(var(--accent))" : "none",
  })

  return (
    <div className="flex flex-col h-full min-w-[120px]">
      <div className="text-center py-2 mb-2">
        <div
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color: "#000000" }}
        >
          {positionLabel}
        </div>
        {secondaryLabel && (
          <div
            className="text-xs mt-0.5 font-normal normal-case opacity-80"
            style={{ color: "#000000" }}
          >
            {secondaryLabel}
          </div>
        )}
      </div>

      <div
        className={`flex-1 flex flex-col gap-2 ${isDimmed ? "opacity-60 pointer-events-none" : ""}`}
      >
        {/* Starter (1st String) - visually emphasized */}
        <div
          className="flex-1 min-h-[120px]"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverString(1)
          }}
          onDragLeave={() => setDragOverString(null)}
          onDrop={(e) => handleDrop(e, 1)}
          style={dropZoneStyle(1)}
        >
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
                handleSlotDragStart(starter.player.id, 1)
              }}
            />
          ) : (
            <div
              className="w-full h-full border-2 border-dashed rounded flex flex-col items-center justify-center min-h-[100px] gap-0.5 py-2"
              style={{
                borderColor: "rgb(var(--focus))",
                backgroundColor: "transparent",
              }}
            >
              <span className="text-xs" style={{ color: "#000000" }}>
                Empty
              </span>
              {emptySlotHint && (
                <span className="text-[10px] opacity-75 text-center px-1" style={{ color: "#64748b" }}>
                  Best fits: {emptySlotHint}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2nd String */}
        <div
          className="flex-shrink-0"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverString(2)
          }}
          onDragLeave={() => setDragOverString(null)}
          onDrop={(e) => handleDrop(e, 2)}
          style={dropZoneStyle(2)}
        >
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
                handleSlotDragStart(secondString.player.id, 2)
              }}
            />
          ) : (
            <div
              className="w-full h-16 border border-dashed rounded flex items-center justify-center"
              style={{
                borderColor: "rgb(var(--focus))",
                backgroundColor: "transparent",
              }}
            >
              <span className="text-[10px]" style={{ color: "#000000" }}>
                2nd
              </span>
            </div>
          )}
        </div>

        {/* 3rd String */}
        <div
          className="flex-shrink-0"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverString(3)
          }}
          onDragLeave={() => setDragOverString(null)}
          onDrop={(e) => handleDrop(e, 3)}
          style={dropZoneStyle(3)}
        >
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
                handleSlotDragStart(thirdString.player.id, 3)
              }}
            />
          ) : (
            <div
              className="w-full h-12 border border-dashed rounded flex items-center justify-center"
              style={{
                borderColor: "rgb(var(--focus))",
                backgroundColor: "transparent",
              }}
            >
              <span className="text-[10px]" style={{ color: "#000000" }}>
                3rd
              </span>
            </div>
          )}
        </div>

        {moreCount > 0 && (
          <div
            className="text-xs text-center py-1 px-2 rounded border"
            style={{
              color: "#000000",
              backgroundColor: "rgb(var(--platinum))",
              borderColor: "rgb(var(--border))",
              borderWidth: "1px",
            }}
          >
            +{moreCount} more
          </div>
        )}
      </div>
    </div>
  )
}
