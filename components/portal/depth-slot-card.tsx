"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { getPlayerPhotoUrl, type RosterPlayerForSlot } from "@/lib/depth-chart/player-resolve"

interface DepthSlotCardProps {
  player: RosterPlayerForSlot
  depthLevel: 1 | 2 | 3
  canEdit: boolean
  onRemove?: () => void
  onPromote?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

function PlayerPhoto({
  player,
  size = 40,
  className = "",
}: {
  player: RosterPlayerForSlot
  size?: number
  className?: string
}) {
  const [error, setError] = useState(false)
  const url = getPlayerPhotoUrl(player)

  if (!url || error) {
    const initials =
      ((player.firstName?.[0] ?? "") + (player.lastName?.[0] ?? "")).toUpperCase() || "?"
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-slate-300 text-slate-600 font-semibold shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {initials}
      </div>
    )
  }

  return (
    <Image
      src={url}
      alt={`${player.firstName} ${player.lastName}`}
      width={size}
      height={size}
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
      unoptimized
      onError={() => setError(true)}
    />
  )
}

export function DepthSlotCard({
  player,
  depthLevel,
  canEdit,
  onRemove,
  onPromote,
  draggable = false,
  onDragStart,
}: DepthSlotCardProps) {
  if (!player) return null
  const isStarter = depthLevel === 1
  const heightClass = depthLevel === 1 ? "min-h-[100px]" : depthLevel === 2 ? "min-h-[72px]" : "min-h-[60px]"
  const opacity = depthLevel === 1 ? 1 : depthLevel === 2 ? 0.85 : 0.7

  return (
    <Card
      className={`relative w-full transition-all duration-200 cursor-pointer ${heightClass} ${
        draggable ? "cursor-move" : ""
      } ${canEdit && onPromote && !isStarter ? "hover:opacity-90" : ""}`}
      style={{
        backgroundColor: isStarter ? "#FFFFFF" : "rgb(var(--braik-navy))",
        borderWidth: isStarter ? "2px" : "1px",
        borderColor: isStarter ? "rgb(var(--accent))" : "rgba(59, 130, 246, 0.3)",
        boxShadow: isStarter ? "0 2px 8px rgba(0, 0, 0, 0.1)" : undefined,
        opacity,
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={canEdit && onPromote && !isStarter ? onPromote : undefined}
      title={canEdit && onPromote && !isStarter ? "Click to promote to starter" : ""}
    >
      <CardContent className="p-2 flex items-center gap-2">
        <PlayerPhoto player={player} size={isStarter ? 48 : 36} />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {player.jerseyNumber != null && (
              <span className="text-sm font-bold" style={{ color: "#000000" }}>
                #{player.jerseyNumber}
              </span>
            )}
            <span className="text-sm font-semibold truncate" style={{ color: "#000000" }}>
              {player.lastName}
            </span>
          </div>
          {player.positionGroup && (
            <div className="text-[10px] font-medium truncate" style={{ color: "#64748b" }}>
              {player.positionGroup}
            </div>
          )}
        </div>
      </CardContent>
      {canEdit && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700 z-10"
          title="Remove player"
        >
          ×
        </button>
      )}
    </Card>
  )
}
