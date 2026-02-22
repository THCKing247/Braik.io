"use client"

import { useState } from "react"
import { PlayerCard } from "./player-card"

interface Player {
  id: string
  firstName: string
  lastName: string
  grade: number | null
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  notes: string | null
  imageUrl?: string | null
}

interface RosterGridViewProps {
  players: Player[]
  canEdit: boolean
}

export function RosterGridView({ 
  players, 
  canEdit
}: RosterGridViewProps) {
  const [uploadingPlayerId, setUploadingPlayerId] = useState<string | null>(null)

  const handleImageUpload = async (playerId: string, file: File) => {
    setUploadingPlayerId(playerId)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`/api/roster/${playerId}/image`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload image")
      }

      const data = await response.json()
      
      // Update the player's imageUrl in the local state
      const player = players.find(p => p.id === playerId)
      if (player) {
        player.imageUrl = data.imageUrl
      }

      // Reload the page to show the new image
      window.location.reload()
    } catch (error) {
      alert("Error uploading image. Please try again.")
    } finally {
      setUploadingPlayerId(null)
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          canEdit={canEdit}
          draggable={canEdit}
          onDragStart={(e) => {
            e.dataTransfer.setData("playerId", player.id)
            e.dataTransfer.effectAllowed = "move"
          }}
          onImageUpload={canEdit ? handleImageUpload : undefined}
        />
      ))}
      {players.length === 0 && (
        <div className="col-span-full text-center py-12" style={{ color: "#000000" }}>
          No players in roster
        </div>
      )}
    </div>
  )
}
