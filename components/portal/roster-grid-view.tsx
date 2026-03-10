"use client"

import { useState } from "react"
import { PlayerCard } from "./player-card"
import { Button } from "@/components/ui/button"

export interface Player {
  id: string
  firstName: string
  lastName: string
  grade: number | null
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  notes: string | null
  imageUrl?: string | null
  email?: string | null
  inviteCode?: string | null
  inviteStatus?: "not_invited" | "invited" | "joined"
  healthStatus?: "active" | "injured" | "unavailable"
  user?: { email: string } | null
  guardianLinks?: Array<{ guardian: { user: { email: string } } }>
}

interface RosterGridViewProps {
  players: Player[]
  canEdit: boolean
  onEditPlayer?: (player: Player) => void
  onSendInvite?: (player: Player) => void | Promise<void>
  onDeletePlayer?: (player: Player) => void | Promise<void>
  onImageUploadSuccess?: (playerId: string, imageUrl: string) => void
}

export function RosterGridView({
  players,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onDeletePlayer,
  onImageUploadSuccess,
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
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error ?? "Failed to upload image")
      }

      const data = await response.json()
      onImageUploadSuccess?.(playerId, data.imageUrl)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error uploading image. Please try again.")
    } finally {
      setUploadingPlayerId(null)
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {players.map((player) => (
        <div key={player.id} className="flex flex-col gap-2">
          <PlayerCard
            player={player}
            canEdit={canEdit}
            draggable={canEdit}
            onDragStart={(e) => {
              e.dataTransfer.setData("playerId", player.id)
              e.dataTransfer.effectAllowed = "move"
            }}
            onImageUpload={canEdit ? handleImageUpload : undefined}
          />
          {canEdit && (onEditPlayer || onSendInvite || onDeletePlayer) && (
            <div className="flex flex-wrap gap-1">
              {onEditPlayer && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 flex-1 min-w-0"
                  onClick={() => onEditPlayer(player)}
                >
                  Edit
                </Button>
              )}
              {onSendInvite && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 flex-1 min-w-0"
                  onClick={() => onSendInvite(player)}
                  disabled={!!player.user}
                  title={player.user ? "Player already has an account" : "Generate invite code to share"}
                >
                  Send invite
                </Button>
              )}
              {onDeletePlayer && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 min-w-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => onDeletePlayer(player)}
                  title="Remove from roster"
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
      {players.length === 0 && (
        <div className="col-span-full text-center py-12" style={{ color: "#000000" }}>
          No players in roster
        </div>
      )}
    </div>
  )
}
