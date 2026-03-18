"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"

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
  playerPhone?: string | null
  inviteCode?: string | null
  inviteStatus?: "not_invited" | "invite_created" | "invite_sent" | "email_sent" | "sms_sent" | "claimed" | "invited" | "joined"
  joinLink?: string | null
  healthStatus?: "active" | "injured" | "unavailable"
  missingForms?: string[]
  weight?: number | null
  height?: string | null
  user?: { email: string } | null
  guardianLinks?: Array<{ guardian: { user: { email: string } } }>
}

type SortKey = "name" | "jersey" | "position" | "grade" | "weight" | "height" | "status"

interface RosterListViewProps {
  players: Player[]
  canEdit: boolean
  onEditPlayer?: (player: Player) => void
  onSendInvite?: (player: Player) => void | Promise<void>
  onCopyJoinLink?: (player: Player) => void
  onResendInvite?: (player: Player) => void | Promise<void>
  onRevokeInvite?: (player: Player) => void | Promise<void>
  onDeletePlayer?: (player: Player) => void | Promise<void>
  onPromotePlayer?: (player: Player) => void
  getProfileHref?: (player: Player) => string
}

function getInitials(firstName: string, lastName: string) {
  const first = (firstName || "")[0] || ""
  const last = (lastName || "")[0] || ""
  return `${first}${last}`.toUpperCase() || "?"
}

function sortPlayers(list: Player[], key: SortKey, dir: "asc" | "desc"): Player[] {
  const mult = dir === "asc" ? 1 : -1
  const out = [...list]
  const statusOrder = (p: Player) => {
    const s = p.healthStatus || (p.status === "active" ? "active" : "inactive")
    if (s === "active") return 0
    if (s === "injured") return 1
    return 2
  }
  out.sort((a, b) => {
    switch (key) {
      case "name": {
        const an = `${a.lastName ?? ""} ${a.firstName ?? ""}`.toLowerCase().trim()
        const bn = `${b.lastName ?? ""} ${b.firstName ?? ""}`.toLowerCase().trim()
        return mult * an.localeCompare(bn)
      }
      case "jersey": {
        const aj = a.jerseyNumber ?? 9999
        const bj = b.jerseyNumber ?? 9999
        return mult * (aj - bj)
      }
      case "position":
        return mult * (a.positionGroup ?? "").localeCompare(b.positionGroup ?? "")
      case "grade": {
        const ag = a.grade ?? -1
        const bg = b.grade ?? -1
        return mult * (ag - bg)
      }
      case "weight": {
        const aw = a.weight ?? -1
        const bw = b.weight ?? -1
        return mult * (aw - bw)
      }
      case "height":
        return mult * (a.height ?? "").localeCompare(b.height ?? "")
      case "status":
        return mult * (statusOrder(a) - statusOrder(b))
      default:
        return 0
    }
  })
  return out
}

function SortTh({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  className = "",
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  dir: "asc" | "desc"
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = currentKey === sortKey
  return (
    <th className={`px-4 py-3 font-semibold text-[#0F172A] ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-[#2563EB] focus:outline-none focus-visible:ring-2 rounded"
        title={`Sort by ${label}`}
      >
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#2563EB]" : "text-[#94A3B8] opacity-70"}`} />
        {active && <span className="sr-only">{dir === "asc" ? "ascending" : "descending"}</span>}
      </button>
    </th>
  )
}

export function RosterListView({
  players,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onCopyJoinLink,
  onResendInvite,
  onRevokeInvite,
  onDeletePlayer,
  onPromotePlayer,
  getProfileHref,
}: RosterListViewProps) {
  const [playersState, setPlayersState] = useState<Player[]>(players)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    setPlayersState(players)
  }, [players])

  const sortedPlayers = useMemo(
    () => sortPlayers(playersState, sortKey, sortDir),
    [playersState, sortKey, sortDir]
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const showActions =
    getProfileHref ||
    (canEdit &&
      (onEditPlayer ||
        onSendInvite ||
        onCopyJoinLink ||
        onResendInvite ||
        onRevokeInvite ||
        onDeletePlayer ||
        onPromotePlayer))

  return (
    <div
      className="overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white overflow-x-hidden [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      style={{ minHeight: "420px", maxHeight: "800px" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <th className="px-4 py-3 font-semibold text-[#0F172A] w-12">Photo</th>
              <SortTh label="Name" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="#" sortKey="jersey" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-20" />
              <SortTh label="Position" sortKey="position" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-28" />
              <SortTh label="Grade" sortKey="grade" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-24" />
              <SortTh label="Weight" sortKey="weight" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-24" />
              <SortTh label="Height" sortKey="height" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-24" />
              <SortTh label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="w-24" />
              {showActions && <th className="px-4 py-3 font-semibold text-[#0F172A] text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player) => (
              <RosterListRow
                key={player.id}
                player={player}
                canEdit={canEdit}
                onEditPlayer={onEditPlayer}
                onSendInvite={onSendInvite}
                onCopyJoinLink={onCopyJoinLink}
                onResendInvite={onResendInvite}
                onRevokeInvite={onRevokeInvite}
                onDeletePlayer={onDeletePlayer}
                onPromotePlayer={onPromotePlayer}
                profileHref={getProfileHref?.(player)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {sortedPlayers.length === 0 && <div className="py-12 text-center text-[#64748B]">No players in roster</div>}
    </div>
  )
}

function RosterListRow({
  player,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onCopyJoinLink,
  onResendInvite,
  onRevokeInvite,
  onDeletePlayer,
  onPromotePlayer,
  profileHref,
}: {
  player: Player
  canEdit: boolean
  onEditPlayer?: (player: Player) => void
  onSendInvite?: (player: Player) => void | Promise<void>
  onCopyJoinLink?: (player: Player) => void
  onResendInvite?: (player: Player) => void | Promise<void>
  onRevokeInvite?: (player: Player) => void | Promise<void>
  onDeletePlayer?: (player: Player) => void | Promise<void>
  onPromotePlayer?: (player: Player) => void
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

  const showActions =
    canEdit &&
    (onEditPlayer ||
      onSendInvite ||
      onCopyJoinLink ||
      onResendInvite ||
      onRevokeInvite ||
      onDeletePlayer ||
      onPromotePlayer)

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
            <span className="text-xs font-semibold text-[#64748B]">{getInitials(player.firstName, player.lastName)}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2 font-medium text-[#0F172A]">
        <div className="flex items-center gap-2">
          {profileHref && (
            <Link
              href={profileHref}
              aria-label={`View ${player.firstName} ${player.lastName} profile`}
              onClick={(e) => e.stopPropagation()}
              className="text-[#2563EB] hover:opacity-80 transition-opacity shrink-0"
              title="Profile"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
            </Link>
          )}
          <span>
            {player.firstName} {player.lastName}
          </span>
        </div>
      </td>
      <td className="px-4 py-2 text-[#475569]">{player.jerseyNumber != null ? `#${player.jerseyNumber}` : "—"}</td>
      <td className="px-4 py-2 text-[#475569]">{player.positionGroup ?? "—"}</td>
      <td className="px-4 py-2 text-[#475569]">{player.grade != null ? player.grade : "—"}</td>
      <td className="px-4 py-2 text-[#475569]">{player.weight != null ? `${player.weight}` : "—"}</td>
      <td className="px-4 py-2 text-[#475569]">{player.height ?? "—"}</td>
      <td className="px-4 py-2">
        <div className="flex flex-col gap-0.5">
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-semibold w-fit ${getStatusDisplay().color} ${getStatusDisplay().bgColor} border`}
          >
            {getStatusDisplay().text}
          </span>
          {player.inviteStatus === "email_sent" && <span className="text-[10px] text-blue-700">Email sent</span>}
          {player.inviteStatus === "sms_sent" && <span className="text-[10px] text-sky-700">SMS sent</span>}
          {(player.inviteStatus === "invite_created" || player.inviteStatus === "invite_sent" || player.inviteStatus === "invited") && (
            <span className="text-[10px] text-amber-700">Invite created</span>
          )}
          {(player.inviteStatus === "claimed" || player.inviteStatus === "joined") && player.user && (
            <span className="text-[10px] text-emerald-700">Claimed</span>
          )}
        </div>
      </td>
      {showActions && (
        <td className="px-4 py-2 text-right">
          <div className="flex flex-wrap gap-1 justify-end">
            {onEditPlayer && (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onEditPlayer(player)}>
                Edit
              </Button>
            )}
            {onPromotePlayer && (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onPromotePlayer(player)} title="Move to another team level">
                Move to…
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
            {onCopyJoinLink &&
              (player.inviteStatus === "invite_created" ||
                player.inviteStatus === "invite_sent" ||
                player.inviteStatus === "invited" ||
                player.inviteStatus === "email_sent" ||
                player.inviteStatus === "sms_sent") &&
              player.joinLink && (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onCopyJoinLink(player)} title="Copy join link">
                  Copy link
                </Button>
              )}
            {onResendInvite &&
              (player.inviteStatus === "invite_created" ||
                player.inviteStatus === "invite_sent" ||
                player.inviteStatus === "invited" ||
                player.inviteStatus === "email_sent" ||
                player.inviteStatus === "sms_sent") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => onResendInvite(player)}
                  disabled={!!player.user}
                  title="Resend invite"
                >
                  Resend
                </Button>
              )}
            {onRevokeInvite &&
              (player.inviteStatus === "invite_created" ||
                player.inviteStatus === "invite_sent" ||
                player.inviteStatus === "invited" ||
                player.inviteStatus === "email_sent" ||
                player.inviteStatus === "sms_sent") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 text-amber-700 hover:bg-amber-50"
                  onClick={() => onRevokeInvite(player)}
                  disabled={!!player.user}
                  title="Revoke invite"
                >
                  Revoke
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
