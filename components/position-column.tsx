"use client"

import { useState } from "react"
import { StarterCard } from "./starter-card"
import { DepthCard } from "./depth-card"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  imageUrl?: string | null
}

interface PositionColumnProps {
  position: string
  positionLabel: string
  players: Array<{ player: Player; string: number }>
  canEdit: boolean
  onDrop?: (position: string, string: number, playerId: string) => void
  onRemove?: (position: string, string: number) => void
  onReorder?: (position: string, fromString: number, toString: number) => void
}

export function PositionColumn({
  position,
  positionLabel,
  players,
  canEdit,
  onDrop,
  onRemove,
  onReorder,
}: PositionColumnProps) {
  const [dragOverString, setDragOverString] = useState<number | null>(null)
  const [draggedString, setDraggedString] = useState<number | null>(null)

  const starter = players.find((p) => p.string === 1)
  const secondString = players.find((p) => p.string === 2)
  const thirdString = players.find((p) => p.string === 3)
  const moreCount = players.filter((p) => p.string > 3).length

  const handleDrop = (e: React.DragEvent, targetString: number) => {
    e.preventDefault()
    const playerId = e.dataTransfer.getData("playerId")
    const sourceString = e.dataTransfer.getData("sourceString")
    
    if (playerId && onDrop) {
      // If dragging from within this column, reorder
      if (sourceString && onReorder) {
        onReorder(position, parseInt(sourceString), targetString)
      } else {
        // Dropping from player pool
        onDrop(position, targetString, playerId)
      }
    }
    setDragOverString(null)
    setDraggedString(null)
  }

  const handlePromote = (fromString: number) => {
    if (onReorder) {
      onReorder(position, fromString, 1)
    }
  }

  return (
    <div className="flex flex-col h-full min-w-[140px]">
      {/* Position Label */}
      <div
        className="text-sm font-bold text-center py-2 mb-2 uppercase tracking-wide"
        style={{ color: "#000000" }}
      >
        {positionLabel}
      </div>

      {/* Column Container */}
      <div className="flex-1 flex flex-col gap-2">
        {/* Starter (1st String) */}
        <div
          className="flex-1 min-h-[120px]"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverString(1)
          }}
          onDragLeave={() => setDragOverString(null)}
          onDrop={(e) => handleDrop(e, 1)}
          style={{
            backgroundColor: dragOverString === 1 ? "rgba(37, 99, 235, 0.1)" : "transparent",
            borderRadius: "4px",
            transition: "background-color 0.2s",
            border: dragOverString === 1 ? "2px dashed rgb(var(--accent))" : "none",
          }}
        >
          {starter ? (
            <StarterCard
              player={starter.player}
              canEdit={canEdit}
              onRemove={onRemove ? () => onRemove(position, 1) : undefined}
            />
          ) : (
            <div
              className="w-full h-full border-2 border-dashed rounded flex items-center justify-center"
              style={{
                borderColor: "rgb(var(--focus))",
                backgroundColor: "transparent",
              }}
            >
              <span className="text-xs" style={{ color: "#000000" }}>Empty</span>
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
          style={{
            backgroundColor: dragOverString === 2 ? "rgba(37, 99, 235, 0.1)" : "transparent",
            borderRadius: "4px",
            transition: "background-color 0.2s",
            border: dragOverString === 2 ? "2px dashed rgb(var(--accent))" : "none",
          }}
        >
          {secondString ? (
            <DepthCard
              player={secondString.player}
              string={2}
              canEdit={canEdit}
              onPromote={canEdit ? () => handlePromote(2) : undefined}
              onRemove={onRemove ? () => onRemove(position, 2) : undefined}
              draggable={canEdit}
              onDragStart={(e) => {
                e.dataTransfer.setData("playerId", secondString.player.id)
                e.dataTransfer.setData("sourceString", "2")
                e.dataTransfer.effectAllowed = "move"
                setDraggedString(2)
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
              <span className="text-[10px]" style={{ color: "#000000" }}>2nd</span>
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
          style={{
            backgroundColor: dragOverString === 3 ? "rgba(37, 99, 235, 0.1)" : "transparent",
            borderRadius: "4px",
            transition: "background-color 0.2s",
            border: dragOverString === 3 ? "2px dashed rgb(var(--accent))" : "none",
          }}
        >
          {thirdString ? (
            <DepthCard
              player={thirdString.player}
              string={3}
              canEdit={canEdit}
              onPromote={canEdit ? () => handlePromote(3) : undefined}
              onRemove={onRemove ? () => onRemove(position, 3) : undefined}
              draggable={canEdit}
              onDragStart={(e) => {
                e.dataTransfer.setData("playerId", thirdString.player.id)
                e.dataTransfer.setData("sourceString", "3")
                e.dataTransfer.effectAllowed = "move"
                setDraggedString(3)
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
              <span className="text-[10px]" style={{ color: "#000000" }}>3rd</span>
            </div>
          )}
        </div>

        {/* More indicator */}
        {moreCount > 0 && (
          <div
            className="text-xs text-center py-1 px-2 rounded border"
            style={{
              color: "#000000",
              backgroundColor: "rgb(var(--platinum))",
              borderColor: "rgb(var(--border))",
              borderWidth: "1px"
            }}
          >
            +{moreCount} more
          </div>
        )}
      </div>
    </div>
  )
}
