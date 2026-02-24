"use client"

import { Card, CardContent } from "@/components/ui/card"

interface DepthCardProps {
  player: {
    id: string
    firstName: string
    lastName: string
    jerseyNumber: number | null
    imageUrl?: string | null
  }
  string: number // 2 or 3
  canEdit: boolean
  primaryColor?: string
  secondaryColor?: string
  onPromote?: () => void
  onRemove?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

export function DepthCard({
  player,
  string,
  canEdit,
  onPromote,
  onRemove,
  draggable = false,
  onDragStart,
}: DepthCardProps) {
  const heightClass = string === 2 ? "h-[70%]" : "h-[55%]"
  const opacity = string === 2 ? 0.7 : 0.5

  return (
    <Card
      className={`relative w-full transition-all duration-200 cursor-pointer ${heightClass} ${
        draggable ? "cursor-move" : ""
      } ${canEdit && onPromote ? "hover:opacity-90" : ""}`}
      style={{
        backgroundColor: "rgb(var(--braik-navy))",
        borderWidth: "1px",
        borderColor: "rgba(59, 130, 246, 0.3)",
        opacity: opacity,
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={canEdit && onPromote ? onPromote : undefined}
      title={canEdit && onPromote ? `Click to promote to starter` : ""}
    >
      <CardContent className="p-2">
        <div className="flex flex-col items-center text-center">
          {/* Jersey Number */}
          {player.jerseyNumber && (
            <div
              className="text-sm font-bold mb-0.5"
              style={{ color: "#000000" }}
            >
              #{player.jerseyNumber}
            </div>
          )}
          
          {/* Last Name */}
          <div
            className="text-xs font-medium truncate w-full"
            style={{ color: "#000000" }}
          >
            {player.lastName}
          </div>
        </div>
      </CardContent>
      
      {canEdit && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-700 z-10"
          title="Remove player"
        >
          ×
        </button>
      )}
    </Card>
  )
}
