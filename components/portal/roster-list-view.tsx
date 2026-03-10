"use client"

import { useState } from "react"
import Image from "next/image"
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
}: RosterListViewProps) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
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
              {canEdit && (onEditPlayer || onSendInvite || onDeletePlayer) && (
                <th className="px-4 py-3 font-semibold text-[#0F172A] text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <RosterListRow
                key={player.id}
                player={player}
                canEdit={canEdit}
                onEditPlayer={onEditPlayer}
                onSendInvite={onSendInvite}
                onDeletePlayer={onDeletePlayer}
              />
            ))}
          </tbody>
        </table>
      </div>
      {players.length === 0 && (
        <div className="py-12 text-center text-[#64748B]">
          No players in roster
        </div>
      )}
    </div>
  )
}

function RosterListRow({
  player,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onDeletePlayer,
}: {
  player: Player
  canEdit: boolean
  onEditPlayer?: (player: Player) => void
  onSendInvite?: (player: Player) => void | Promise<void>
  onDeletePlayer?: (player: Player) => void | Promise<void>
}) {
  const [imageError, setImageError] = useState(false)

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
          className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: "rgb(var(--platinum))",
            borderColor: "rgb(var(--border))",
            borderWidth: "1px",
            color: "#0F172A",
          }}
        >
          {player.status === "active" ? "Active" : "Inactive"}
        </span>
      </td>
      {canEdit && (onEditPlayer || onSendInvite || onDeletePlayer) && (
        <td className="px-4 py-2 text-right">
          <div className="flex flex-wrap gap-1 justify-end">
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
