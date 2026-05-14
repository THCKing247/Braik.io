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
        className={`flex items-center justify-center rounded-full shrink-0 ${className} ${
          size >= 40
            ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            : "bg-slate-700/90 text-slate-100 ring-1 ring-white/15"
        } font-semibold`}
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

const DEPTH_BADGE: Record<1 | 2 | 3, string> = {
  1: "1st",
  2: "2nd",
  3: "3rd",
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
  const isBench = !isStarter

  return (
    <Card
      className={`group relative w-full max-w-full overflow-hidden rounded-xl ${heightClass} shrink-0 border transition-all duration-300 ease-out will-change-transform ${
        draggable ? "cursor-move" : "cursor-default"
      } ${
        isBench
          ? "hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
          : "hover:shadow-md hover:-translate-y-0.5"
      }`}
      style={
        isStarter
          ? {
              backgroundColor: "#FFFFFF",
              borderWidth: 2,
              borderColor: "rgb(var(--accent))",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            }
          : {
              backgroundColor: "rgb(var(--braik-navy))",
              borderWidth: 1,
              borderColor: "rgba(148, 163, 184, 0.35)",
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.35)",
            }
      }
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={canEdit && onPromote && !isStarter ? onPromote : undefined}
      title={canEdit && onPromote && !isStarter ? "Click to promote to starter" : ""}
    >
      <CardContent className="p-2.5 flex items-stretch gap-2 h-full box-border relative min-h-0">
        <PlayerPhoto player={player} size={isStarter ? 44 : 32} className={isBench ? "ring-2 ring-white/10 self-center" : "self-center"} />
        <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden gap-0.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 shrink-0 ${
                isStarter
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-white/15 text-slate-100 border border-white/20"
              }`}
            >
              {DEPTH_BADGE[depthLevel]}
            </span>
            {player.jerseyNumber != null && (
              <span
                className={`inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md text-xs font-bold tabular-nums shrink-0 ${
                  isStarter
                    ? "bg-slate-900 text-white"
                    : "bg-sky-400/25 text-sky-100 border border-sky-300/30"
                }`}
              >
                #{player.jerseyNumber}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 min-w-0">
            <span
              className={`text-sm font-semibold truncate min-w-0 ${
                isStarter ? "text-slate-900" : "text-slate-50"
              }`}
            >
              {player.lastName}
            </span>
          </div>
          {player.positionGroup && (
            <div
              className={`text-xs font-medium truncate ${
                isStarter ? "text-slate-500" : "text-slate-300"
              }`}
            >
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
          className={`absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-md text-lg leading-none transition-colors z-10 ${
            isStarter
              ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
              : "text-slate-300 hover:text-white hover:bg-red-500/30"
          }`}
          title="Remove player"
        >
          ×
        </button>
      )}
    </Card>
  )
}
