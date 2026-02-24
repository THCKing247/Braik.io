"use client"

import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { useState } from "react"

interface PlayerCardProps {
  player: {
    id: string
    firstName: string
    lastName: string
    jerseyNumber: number | null
    positionGroup: string | null
    status: string
    imageUrl?: string | null
  }
  canEdit?: boolean
  size?: "small" | "medium" | "large"
  primaryColor?: string
  secondaryColor?: string
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onImageUpload?: (playerId: string, file: File) => void
}

export function PlayerCard({
  player,
  canEdit = false,
  size = "medium",
  draggable = false,
  onDragStart,
  onImageUpload,
}: PlayerCardProps) {
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const getInitials = () => {
    const first = (player.firstName || "")[0] || ""
    const last = (player.lastName || "")[0] || ""
    return `${first}${last}`.toUpperCase() || "?"
  }

  const handleImageClick = () => {
    if (canEdit && onImageUpload) {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/*"
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          onImageUpload(player.id, file)
        }
      }
      input.click()
    }
  }

  return (
    <Card
      className={`cursor-pointer hover:shadow-sm transition-all duration-200 border overflow-hidden ${
        draggable ? "cursor-move" : ""
      }`}
      style={{
        borderColor: "rgb(var(--border))",
        backgroundColor: "#FFFFFF",
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-3 flex flex-col items-center h-full">
        {/* Player Image / Placeholder */}
        <div
          className={`w-20 h-28 relative mb-3 rounded border overflow-hidden ${
            canEdit && onImageUpload ? "cursor-pointer" : ""
          }`}
          style={{
            borderColor: "rgb(var(--border))",
            backgroundColor: "rgb(var(--platinum))",
            borderWidth: "1px"
          }}
          onClick={handleImageClick}
          title={canEdit && onImageUpload ? "Click to upload image" : ""}
        >
          {player.imageUrl && !imageError && player.imageUrl.trim() !== "" ? (
            <Image
              src={player.imageUrl}
              alt={`${player.firstName} ${player.lastName}`}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              unoptimized
              sizes="80px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: "rgb(var(--muted))" }}>
              {getInitials()}
            </div>
          )}
          {canEdit && onImageUpload && isHovered && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
              <span className="text-white text-xs font-semibold">Upload</span>
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="w-full text-center flex-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold truncate mb-1" style={{ color: "#000000" }}>
              {player.firstName} {player.lastName}
            </h3>
            <div className="text-xs mb-2" style={{ color: "#000000" }}>
              {player.jerseyNumber && (
                <span className="font-bold">#{player.jerseyNumber}</span>
              )}
              {player.jerseyNumber && player.positionGroup && " • "}
              {player.positionGroup && <span>{player.positionGroup}</span>}
            </div>
          </div>
          <span
            className="text-[10px] px-2 py-1 rounded font-semibold uppercase tracking-wide inline-block"
            style={{
              backgroundColor: "rgb(var(--platinum))",
              borderColor: "rgb(var(--border))",
              borderWidth: "1px",
              color: "#000000"
            }}
          >
            {player.status === "active" ? "A" : "I"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
