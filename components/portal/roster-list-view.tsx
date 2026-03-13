"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, User } from "lucide-react"
import { PlayerFormsModal } from "./player-forms-modal"

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
  weight?: number | null
  height?: string | null
  user?: { email: string } | null
  guardianLinks?: Array<{ guardian: { user: { email: string } } }>
}

interface RosterListViewProps {
  players: Player[]
  canEdit: boolean
  onEditPlayer?: (player: Player) => void
  onSendInvite?: (player: Player) => void | Promise<void>
  onDeletePlayer?: (player: Player) => void | Promise<void>
  /** If provided, each row gets a "View Profile" link. */
  getProfileHref?: (player: Player) => string
}

function getInitials(firstName: string, lastName: string) {
  const first = (firstName || "")[0] || ""
  const last = (lastName || "")[0] || ""
  return `${first}${last}`.toUpperCase() || "?"
}

export function RosterListView({
  players,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onDeletePlayer,
  getProfileHref,
}: RosterListViewProps) {
  const [playersState, setPlayersState] = useState<Player[]>(players)
  const [formsModalPlayer, setFormsModalPlayer] = useState<Player | null>(null)

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

      // Trigger parent refresh
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update forms")
      throw error
    }
  }

  return (
    <>
    <div
      className="overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white overflow-x-hidden [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      style={{ minHeight: "420px", maxHeight: "800px" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <th className="px-4 py-3 font-semibold text-[#0F172A] w-12">Photo</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A]">Name</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A] w-20">#</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A] w-24">Position</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A] w-24">Grade</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A] w-20">Weight</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A] w-20">Height</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A] w-20">Status</th>
              {(getProfileHref || (canEdit && (onEditPlayer || onSendInvite || onDeletePlayer))) && (
                <th className="px-4 py-3 font-semibold text-[#0F172A] text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {playersState.map((player) => (
              <RosterListRow
                key={player.id}
                player={player}
                canEdit={canEdit}
                onEditPlayer={onEditPlayer}
                onSendInvite={onSendInvite}
                onDeletePlayer={onDeletePlayer}
                onOpenFormsModal={() => setFormsModalPlayer(player)}
                profileHref={getProfileHref?.(player)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {playersState.length === 0 && (
        <div className="py-12 text-center text-[#64748B]">
          No players in roster
        </div>
      )}
    </div>
    {formsModalPlayer && (
      <PlayerFormsModal
        player={formsModalPlayer}
        isOpen={!!formsModalPlayer}
        onClose={() => setFormsModalPlayer(null)}
        onFormsUpdate={canEdit ? handleFormsUpdate : undefined}
      />
    )}
    </>
  )
}

function RosterListRow({
  player,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onDeletePlayer,
  onOpenFormsModal,
  profileHref,
}: {
  player: Player
  canEdit: boolean
  onEditPlayer?: (player: Player) => void
  onSendInvite?: (player: Player) => void | Promise<void>
  onDeletePlayer?: (player: Player) => void | Promise<void>
  onOpenFormsModal?: () => void
  profileHref?: string
}) {
  const [imageError, setImageError] = useState(false)

  const getStatusDisplay = () => {
    const status = player.healthStatus || (player.status === "active" ? "active" : "inactive")
    switch (status) {
      case "active":
        return { text: "Active", color: "text-green-600", bgColor: "bg-green-100" }
      case "injured":
        return { text: "Injured", color: "text-red-600", bgColor: "bg-red-100" }
      case "unavailable":
        return { text: "Inactive", color: "text-orange-600", bgColor: "bg-orange-100" }
      default:
        return { text: "Inactive", color: "text-orange-600", bgColor: "bg-orange-100" }
    }
  }

  return (
    <tr className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC]/60 transition-colors">
      <td className="px-4 py-2">
        <div className="w-10 h-12 relative rounded border border-[#E5E7EB] overflow-hidden bg-[#F1F5F9] flex items-center justify-center">
          {player.imageUrl && !imageError && player.imageUrl.trim() !== "" ? (
            <Image
              src={player.imageUrl}
              alt={`${player.firstName} ${player.lastName}`}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              unoptimized
              sizes="40px"
            />
          ) : (
            <span className="text-xs font-semibold text-[#64748B]">
              {getInitials(player.firstName, player.lastName)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2 font-medium text-[#0F172A]">
        {player.firstName} {player.lastName}
      </td>
      <td className="px-4 py-2 text-[#475569]">
        {player.jerseyNumber != null ? `#${player.jerseyNumber}` : "—"}
      </td>
      <td className="px-4 py-2 text-[#475569]">
        {player.positionGroup ?? "—"}
      </td>
      <td className="px-4 py-2 text-[#475569]">
        {player.grade != null ? player.grade : "—"}
      </td>
      <td className="px-4 py-2 text-[#475569]">
        {player.weight != null ? `${player.weight}` : "—"}
      </td>
      <td className="px-4 py-2 text-[#475569]">
        {player.height ?? "—"}
      </td>
      <td className="px-4 py-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${getStatusDisplay().color} ${getStatusDisplay().bgColor} border`}
        >
          {getStatusDisplay().text}
        </span>
      </td>
      {(profileHref || canEdit) && (profileHref || onEditPlayer || onSendInvite || onDeletePlayer) && (
        <td className="px-4 py-2 text-right">
          <div className="flex flex-wrap gap-1 justify-end">
            {profileHref && (
              <Link href={profileHref}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  title="View profile"
                >
                  <User className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
            {canEdit && onOpenFormsModal && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={onOpenFormsModal}
                title="Manage Forms"
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            )}
            {onEditPlayer && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onEditPlayer(player)}
              >
                Edit
              </Button>
            )}
            {onSendInvite && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onSendInvite(player)}
                disabled={!!player.user}
                title={player.user ? "Player already has an account" : "Generate invite code"}
              >
                Invite
              </Button>
            )}
            {onDeletePlayer && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => onDeletePlayer(player)}
                title="Remove from roster"
              >
                Delete
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
