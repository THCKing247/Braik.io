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
  const heightClass =
    depthLevel === 1 ? "h-[104px]" : depthLevel === 2 ? "h-[76px]" : "h-[64px]"
  const opacity = depthLevel === 1 ? 1 : depthLevel === 2 ? 0.85 : 0.7

  return (
    <Card
      className={`relative w-full max-w-full overflow-hidden transition-all duration-200 cursor-pointer rounded-lg ${heightClass} shrink-0 ${
        draggable ? "cursor-move" : ""
      } ${canEdit && onPromote && !isStarter ? "hover:opacity-90" : ""}`}
      style={{
        backgroundColor: isStarter ? "#FFFFFF" : "rgb(var(--braik-navy))",
        borderWidth: isStarter ? "2px" : "1px",
        borderColor: isStarter ? "rgb(var(--accent))" : "rgba(59, 130, 246, 0.3)",
        boxShadow: isStarter ? "0 1px 4px rgba(0, 0, 0, 0.08)" : undefined,
        opacity,
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={canEdit && onPromote && !isStarter ? onPromote : undefined}
      title={canEdit && onPromote && !isStarter ? "Click to promote to starter" : ""}
    >
      <CardContent className="p-2.5 flex items-center gap-2 h-full box-border">
        <PlayerPhoto player={player} size={isStarter ? 44 : 32} />
        <div className="flex-1 min-w-0 text-left overflow-hidden">
          <div className="flex items-baseline gap-1 min-w-0">
            {player.jerseyNumber != null && (
              <span className="text-sm font-bold text-slate-900 shrink-0">
                #{player.jerseyNumber}
              </span>
            )}
            <span className="text-sm font-semibold truncate text-slate-900 min-w-0">
              {player.lastName}
            </span>
          </div>
          {player.positionGroup && (
            <div className="text-xs font-normal truncate text-slate-500 mt-0.5">
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
          className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors z-10 text-sm"
          title="Remove player"
        >
          ×
        </button>
      )}
    </Card>
  )
}
