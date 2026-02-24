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
  primaryColor?: string
  secondaryColor?: string
  onRemove?: () => void
  onPromote?: () => void
}

export function StarterCard({
  player,
  canEdit,
  onRemove,
  onPromote,
}: StarterCardProps) {
  return (
    <Card
      className="relative w-full transition-all duration-200 hover:shadow-sm"
      style={{
        backgroundColor: "#FFFFFF",
        borderWidth: "2px",
        borderColor: "rgb(var(--accent))",
        boxShadow: `0 2px 8px rgba(0, 0, 0, 0.1)`,
      }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col items-center text-center">
          {/* Jersey Number */}
          {player.jerseyNumber && (
            <div
              className="text-2xl font-bold mb-1"
              style={{ color: "#000000" }}
            >
              #{player.jerseyNumber}
            </div>
          )}
          
          {/* Last Name */}
          <div
            className="text-base font-semibold truncate w-full"
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
          className="absolute -top-2 -right-2 rounded-full w-6 h-6 flex items-center justify-center text-sm z-10"
          style={{
            backgroundColor: "rgb(var(--accent))",
            color: "#FFFFFF"
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          title="Remove player"
        >
          ×
        </button>
      )}
    </Card>
  )
}
