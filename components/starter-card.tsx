"use client"

import { Card, CardContent } from "@/components/ui/card"

interface StarterCardProps {
  player: {
    id: string
    firstName: string
    lastName: string
    jerseyNumber: number | null
    imageUrl?: string | null
  }
  canEdit: boolean
  onRemove?: () => void
}

export function StarterCard({ player, canEdit, onRemove }: StarterCardProps) {
  return (
    <Card
      className="relative w-full h-full transition-all duration-200"
      style={{
        backgroundColor: "rgb(var(--braik-navy))",
        borderWidth: "1px",
        borderColor: "rgba(59, 130, 246, 0.5)",
      }}
    >
      <CardContent className="p-2">
        <div className="flex flex-col items-center text-center">
          {player.jerseyNumber && (
            <div className="text-sm font-bold mb-0.5" style={{ color: "#000000" }}>
              #{player.jerseyNumber}
            </div>
          )}
          <div className="text-xs font-medium truncate w-full" style={{ color: "#000000" }}>
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
