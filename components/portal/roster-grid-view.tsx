"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { PlayerCard } from "./player-card"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"

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
  missingForms?: string[]
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
  /** If provided, each player card gets a "View Profile" link to this URL (e.g. /dashboard/roster/[playerId]?teamId=xxx). */
  getProfileHref?: (player: Player) => string
}

export function RosterGridView({
  players,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onDeletePlayer,
  onImageUploadSuccess,
  getProfileHref,
}: RosterGridViewProps) {
  const [uploadingPlayerId, setUploadingPlayerId] = useState<string | null>(null)
  const [playersState, setPlayersState] = useState<Player[]>(players)

  // Update local state when players prop changes
  useEffect(() => {
    setPlayersState(players)
  }, [players])

  const handleFormsUpdate = async (playerId: string, formsComplete: boolean, missingForms: string[]) => {
    try {
      const response = await fetch(`/api/roster/${playerId}/forms`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formsComplete,
          missingForms,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error || "Failed to update forms")
      }

      const updated = await response.json()
      
      // Update local state
      setPlayersState(prev => prev.map(p => 
        p.id === playerId 
          ? { ...p, missingForms: updated.missingForms || [], healthStatus: updated.healthStatus }
          : p
      ))

      // Trigger parent refresh if callback exists
      if (onImageUploadSuccess) {
        // Re-fetch roster to get updated data
        window.location.reload()
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update forms")
      throw error
    }
  }

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
    <div
      className="overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white/50 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      style={{ minHeight: "420px", maxHeight: "800px" }}
      aria-label="Roster cards grid"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {playersState.map((player) => (
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
            onFormsUpdate={canEdit ? handleFormsUpdate : undefined}
            profileHref={getProfileHref?.(player)}
          />
          {(getProfileHref || canEdit) && (getProfileHref || onEditPlayer || onSendInvite || onDeletePlayer) && (
            <div className="flex flex-wrap gap-1">
              {getProfileHref && (
                <Link href={getProfileHref(player)} className="flex-1 min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 w-full"
                    title="View profile"
                  >
                    <User className="h-3.5 w-3.5 mr-1" />
                    Profile
                  </Button>
                </Link>
              )}
              {canEdit && onEditPlayer && (
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
      {playersState.length === 0 && (
        <div className="col-span-full text-center py-12" style={{ color: "#000000" }}>
          No players in roster
        </div>
      )}
      </div>
    </div>
  )
}
