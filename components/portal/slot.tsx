"use client"

import { useState } from "react"
import { StarterCard } from "./starter-card"
import { DepthCard } from "./depth-card"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  imageUrl?: string | null
}

interface SlotProps {
  role: string
  xPct: number
  yPct: number
  players: Array<{ player: Player; string: number }>
  primaryColor: string
  secondaryColor: string
  canEdit: boolean
  onDrop: (role: string, string: number, playerId: string) => void
  onRemove: (role: string, string: number) => void
  onReorder: (role: string, fromString: number, toString: number) => void
}

export function Slot({
  role,
  xPct,
  yPct,
  players,
  primaryColor,
  secondaryColor,
  canEdit,
  onDrop,
  onRemove,
  onReorder,
}: SlotProps) {
  const [dragOverString, setDragOverString] = useState<number | null>(null)

  const starter = players.find((p) => p.string === 1)
  const secondString = players.find((p) => p.string === 2)
  const thirdString = players.find((p) => p.string === 3)
  const moreCount = players.filter((p) => p.string > 3).length

  const handleDrop = (e: React.DragEvent, targetString: number) => {
    e.preventDefault()
    e.stopPropagation()
    const playerId = e.dataTransfer.getData("playerId")
    const sourceString = e.dataTransfer.getData("sourceString")

    if (playerId && onDrop) {
      if (sourceString && onReorder) {
        onReorder(role, parseInt(sourceString), targetString)
      } else {
        onDrop(role, targetString, playerId)
      }
    }
    setDragOverString(null)
  }

  const handlePromote = (fromString: number) => {
    if (onReorder) {
      onReorder(role, fromString, 1)
    }
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
        width: "78px",
      }}
    >
      <div className="flex flex-col items-center w-full">
        {/* Role Label */}
        <div
          className="text-xs font-bold text-center mb-1 uppercase tracking-wide px-2 py-0.5 rounded"
          style={{
            color: secondaryColor,
            backgroundColor: "rgba(0, 0, 0, 0.3)",
          }}
        >
          {role}
        </div>

        {/* Slot Container - Depth Stack with increased spacing */}
        <div className="flex flex-col items-center" style={{ gap: "6px", marginTop: "6px" }}>
          {/* Starter (1st String) */}
          <div
            className="w-20"
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              e.dataTransfer.dropEffect = "move"
              setDragOverString(1)
            }}
            onDragLeave={() => setDragOverString(null)}
            onDrop={(e) => handleDrop(e, 1)}
            style={{
              backgroundColor: dragOverString === 1 ? "rgba(255, 255, 255, 0.1)" : "transparent",
              borderRadius: "4px",
              transition: "background-color 0.2s",
            }}
          >
            {starter ? (
              <StarterCard
                player={starter.player}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                canEdit={canEdit}
                onRemove={onRemove ? () => onRemove(role, 1) : undefined}
              />
            ) : (
              <div
                className="w-full h-24 border-2 border-dashed rounded flex items-center justify-center"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                }}
              >
                <span className="text-[10px] text-white/40">Empty</span>
              </div>
            )}
          </div>

          {/* 2nd String */}
          {secondString && (
            <div
              className="w-16"
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                e.dataTransfer.dropEffect = "move"
                setDragOverString(2)
              }}
              onDragLeave={() => setDragOverString(null)}
              onDrop={(e) => handleDrop(e, 2)}
              style={{
                backgroundColor: dragOverString === 2 ? "rgba(255, 255, 255, 0.1)" : "transparent",
                borderRadius: "4px",
                transition: "background-color 0.2s",
              }}
            >
              <DepthCard
                player={secondString.player}
                string={2}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                canEdit={canEdit}
                onPromote={canEdit ? () => handlePromote(2) : undefined}
                onRemove={onRemove ? () => onRemove(role, 2) : undefined}
                draggable={canEdit}
                onDragStart={(e) => {
                  e.dataTransfer.setData("playerId", secondString.player.id)
                  e.dataTransfer.setData("sourceString", "2")
                  e.dataTransfer.effectAllowed = "move"
                }}
              />
            </div>
          )}

          {/* 3rd String */}
          {thirdString && (
            <div
              className="w-14"
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                e.dataTransfer.dropEffect = "move"
                setDragOverString(3)
              }}
              onDragLeave={() => setDragOverString(null)}
              onDrop={(e) => handleDrop(e, 3)}
              style={{
                backgroundColor: dragOverString === 3 ? "rgba(255, 255, 255, 0.1)" : "transparent",
                borderRadius: "4px",
                transition: "background-color 0.2s",
              }}
            >
              <DepthCard
                player={thirdString.player}
                string={3}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                canEdit={canEdit}
                onPromote={canEdit ? () => handlePromote(3) : undefined}
                onRemove={onRemove ? () => onRemove(role, 3) : undefined}
                draggable={canEdit}
                onDragStart={(e) => {
                  e.dataTransfer.setData("playerId", thirdString.player.id)
                  e.dataTransfer.setData("sourceString", "3")
                  e.dataTransfer.effectAllowed = "move"
                }}
              />
            </div>
          )}

          {/* More indicator */}
          {moreCount > 0 && (
            <div
              className="text-[10px] text-center py-0.5 px-1 rounded"
              style={{
                color: "rgba(255, 255, 255, 0.5)",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              }}
            >
              +{moreCount}
            </div>
          )}

          {/* Empty slot indicator for 2nd/3rd if no players */}
          {!secondString && !thirdString && (
            <div className="flex flex-col gap-0.5">
              <div
                className="w-12 h-8 border border-dashed rounded flex items-center justify-center"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = "move"
                  setDragOverString(2)
                }}
                onDragLeave={() => setDragOverString(null)}
                onDrop={(e) => handleDrop(e, 2)}
              >
                <span className="text-[8px] text-white/30">2nd</span>
              </div>
              <div
                className="w-10 h-6 border border-dashed rounded flex items-center justify-center"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = "move"
                  setDragOverString(3)
                }}
                onDragLeave={() => setDragOverString(null)}
                onDrop={(e) => handleDrop(e, 3)}
              >
                <span className="text-[8px] text-white/30">3rd</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
