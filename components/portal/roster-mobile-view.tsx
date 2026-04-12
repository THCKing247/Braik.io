"use client"

import { useMemo, useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RosterPaginationControls, ROSTER_CARDS_PAGE_SIZE } from "@/components/portal/roster-pagination-controls"
import {
  Eye,
  Pencil,
  MessageCircle,
  MoreHorizontal,
  UserPlus,
  Link2,
  RefreshCw,
  Ban,
  Trash2,
  ArrowRightLeft,
} from "lucide-react"

export type MobileRosterSort = "name_az" | "jersey" | "position" | "updated"

export interface RosterMobilePlayer {
  id: string
  firstName: string
  lastName: string
  grade: number | null
  jerseyNumber: number | null
  positionGroup: string | null
  secondaryPosition?: string | null
  status: string
  notes: string | null
  imageUrl?: string | null
  email?: string | null
  playerPhone?: string | null
  inviteStatus?: string | null
  joinLink?: string | null
  user?: { email: string } | null
  healthStatus?: "active" | "injured" | "unavailable"
  updatedAt?: string | null
}

function getInitials(firstName: string, lastName: string) {
  const f = (firstName || "")[0] || ""
  const l = (lastName || "")[0] || ""
  return `${f}${l}`.toUpperCase() || "?"
}

function formatGradeLabel(grade: number | null): string | null {
  if (grade == null) return null
  const map: Record<number, string> = {
    9: "Fr",
    10: "So",
    11: "Jr",
    12: "Sr",
    1: "Yr 1",
    2: "Yr 2",
    3: "Yr 3",
    4: "Yr 4",
  }
  return map[grade] ?? `Gr ${grade}`
}

function statusChip(player: RosterMobilePlayer) {
  const h = player.healthStatus || (player.status === "active" ? "active" : "inactive")
  if (h === "active")
    return { label: "Active", className: "bg-emerald-100 text-emerald-800 border-emerald-200" }
  if (h === "injured")
    return { label: "Injured", className: "bg-red-100 text-red-800 border-red-200" }
  return { label: "Unavailable", className: "bg-amber-100 text-amber-800 border-amber-200" }
}

function sortPlayers(list: RosterMobilePlayer[], sort: MobileRosterSort): RosterMobilePlayer[] {
  const out = [...list]
  switch (sort) {
    case "jersey":
      out.sort((a, b) => {
        const aj = a.jerseyNumber ?? 9999
        const bj = b.jerseyNumber ?? 9999
        return aj - bj
      })
      break
    case "position":
      out.sort((a, b) =>
        (a.positionGroup ?? "").localeCompare(b.positionGroup ?? "", undefined, { sensitivity: "base" })
      )
      break
    case "updated":
      out.sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return tb - ta
      })
      break
    default:
      out.sort((a, b) => {
        const an = `${a.lastName ?? ""} ${a.firstName ?? ""}`.toLowerCase()
        const bn = `${b.lastName ?? ""} ${b.firstName ?? ""}`.toLowerCase()
        return an.localeCompare(bn)
      })
  }
  return out
}

interface RosterMobileViewProps {
  players: RosterMobilePlayer[]
  /** Resets card pagination when search/filters change (must match desktop roster filters). */
  filterKey: string
  sort: MobileRosterSort
  teamId: string
  canEdit: boolean
  onEditPlayer?: (player: RosterMobilePlayer) => void
  onSendInvite?: (player: RosterMobilePlayer) => void | Promise<void>
  onCopyJoinLink?: (player: RosterMobilePlayer) => void
  onResendInvite?: (player: RosterMobilePlayer) => void | Promise<void>
  onRevokeInvite?: (player: RosterMobilePlayer) => void | Promise<void>
  onDeletePlayer?: (player: RosterMobilePlayer) => void | Promise<void>
  onPromotePlayer?: (player: RosterMobilePlayer) => void
  getProfileHref: (player: RosterMobilePlayer) => string
  onAddPlayer?: () => void
  onImport?: () => void
}

export function RosterMobileView({
  players,
  filterKey,
  sort,
  teamId,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onCopyJoinLink,
  onResendInvite,
  onRevokeInvite,
  onDeletePlayer,
  onPromotePlayer,
  getProfileHref,
  onAddPlayer,
  onImport,
}: RosterMobileViewProps) {
  const [morePlayer, setMorePlayer] = useState<RosterMobilePlayer | null>(null)
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => sortPlayers(players, sort), [players, sort])

  useEffect(() => {
    setPage(1)
  }, [filterKey])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sorted.length / ROSTER_CARDS_PAGE_SIZE))
    setPage((p) => Math.min(p, maxPage))
  }, [sorted.length])

  const paged = useMemo(() => {
    const start = (page - 1) * ROSTER_CARDS_PAGE_SIZE
    return sorted.slice(start, start + ROSTER_CARDS_PAGE_SIZE)
  }, [sorted, page])

  if (sorted.length === 0) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-border bg-card px-4 py-12 text-center">
        <div className="mx-auto max-w-sm space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <UserPlus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No players match</h3>
          <p className="text-sm text-muted-foreground">
            {players.length === 0
              ? "Your roster is empty. Add players manually or import from a spreadsheet."
              : "Try adjusting search or filters."}
          </p>
          {canEdit && players.length === 0 && (
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
              {onAddPlayer && (
                <Button className="min-h-[44px] rounded-xl px-6" onClick={onAddPlayer}>
                  Add player
                </Button>
              )}
              {onImport && (
                <Button variant="outline" className="min-h-[44px] rounded-xl px-6" onClick={onImport}>
                  Import CSV
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-8">
      <ul className="grid grid-cols-1 content-start gap-4 md:grid-cols-2 md:gap-5 lg:gap-4">
        {paged.map((player) => (
          <li
            key={player.id}
            className="list-none min-w-0 max-w-full rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            {/* Row 1: avatar, name, jersey */}
            <div className="flex items-start gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                {player.imageUrl?.trim() ? (
                  <Image
                    src={player.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                    {getInitials(player.firstName, player.lastName)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-base font-semibold leading-tight text-foreground">
                    {player.firstName} {player.lastName}
                  </h3>
                  <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold tabular-nums text-primary">
                    {player.jerseyNumber != null ? `#${player.jerseyNumber}` : "—"}
                  </span>
                </div>
                {/* Row 2: position + grade */}
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{player.positionGroup ?? "—"}</span>
                  {player.secondaryPosition?.trim() ? (
                    <span className="text-muted-foreground"> · {player.secondaryPosition}</span>
                  ) : null}
                  {formatGradeLabel(player.grade) ? (
                    <span className="ml-1 text-muted-foreground">
                      · {formatGradeLabel(player.grade)}
                      {player.grade != null && player.grade >= 9 && player.grade <= 12
                        ? ` (${player.grade})`
                        : ""}
                    </span>
                  ) : null}
                </p>
                {/* Row 3: chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(() => {
                    const s = statusChip(player)
                    return (
                      <span
                        className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${s.className}`}
                      >
                        {s.label}
                      </span>
                    )
                  })()}
                  {player.user && (
                    <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Account linked
                    </span>
                  )}
                  {player.inviteStatus === "email_sent" && (
                    <span className="text-xs font-medium text-blue-700">Email sent</span>
                  )}
                  {player.inviteStatus === "sms_sent" && (
                    <span className="text-xs font-medium text-sky-700">Text sent</span>
                  )}
                </div>
                {/* Row 4: actions */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Link
                    href={getProfileHref(player)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted/80"
                  >
                    <Eye className="h-4 w-4 shrink-0" />
                    View
                  </Link>
                  {canEdit && onEditPlayer ? (
                    <button
                      type="button"
                      onClick={() => onEditPlayer(player)}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted/80"
                    >
                      <Pencil className="h-4 w-4 shrink-0" />
                      Edit
                    </button>
                  ) : (
                    <Link
                      href={`/dashboard/messages?teamId=${encodeURIComponent(teamId)}`}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted/80"
                    >
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      Message
                    </Link>
                  )}
                  {canEdit && onEditPlayer && (
                    <Link
                      href={`/dashboard/messages?teamId=${encodeURIComponent(teamId)}`}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted/80"
                    >
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      Message
                    </Link>
                  )}
                  {canEdit &&
                    (onSendInvite ||
                      onCopyJoinLink ||
                      onDeletePlayer ||
                      onPromotePlayer ||
                      onResendInvite ||
                      onRevokeInvite) && (
                      <button
                        type="button"
                        onClick={() => setMorePlayer(player)}
                        className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted/80 ${
                          !onEditPlayer ? "col-span-2" : ""
                        }`}
                      >
                        <MoreHorizontal className="h-4 w-4 shrink-0" />
                        More
                      </button>
                    )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <RosterPaginationControls
        page={page}
        totalItems={sorted.length}
        pageSize={ROSTER_CARDS_PAGE_SIZE}
        onPageChange={setPage}
        className="mt-2 rounded-lg border border-border"
      />

      {/* Bottom sheet — secondary actions */}
      {morePlayer && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
            aria-label="Close"
            onClick={() => setMorePlayer(null)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl lg:hidden"
            role="dialog"
            aria-labelledby="roster-more-title"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <h2 id="roster-more-title" className="mb-4 text-lg font-semibold">
              {morePlayer.firstName} {morePlayer.lastName}
            </h2>
            <div className="flex flex-col gap-2">
              {onSendInvite && !morePlayer.user && (
                <Button
                  variant="outline"
                  className="min-h-[44px] w-full justify-start gap-2 rounded-xl"
                  onClick={() => {
                    void onSendInvite(morePlayer)
                    setMorePlayer(null)
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Invite / generate code
                </Button>
              )}
              {onCopyJoinLink &&
                morePlayer.joinLink &&
                ["invite_created", "invite_sent", "invited", "email_sent", "sms_sent"].includes(
                  morePlayer.inviteStatus ?? ""
                ) && (
                  <Button
                    variant="outline"
                    className="min-h-[44px] w-full justify-start gap-2 rounded-xl"
                    onClick={() => {
                      onCopyJoinLink(morePlayer)
                      setMorePlayer(null)
                    }}
                  >
                    <Link2 className="h-4 w-4" />
                    Copy join link
                  </Button>
                )}
              {onResendInvite && !morePlayer.user && (
                <Button
                  variant="outline"
                  className="min-h-[44px] w-full justify-start gap-2 rounded-xl"
                  onClick={() => {
                    void onResendInvite(morePlayer)
                    setMorePlayer(null)
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Resend invite
                </Button>
              )}
              {onRevokeInvite && !morePlayer.user && (
                <Button
                  variant="outline"
                  className="min-h-[44px] w-full justify-start gap-2 rounded-xl text-amber-800 hover:bg-amber-50"
                  onClick={() => {
                    void onRevokeInvite(morePlayer)
                    setMorePlayer(null)
                  }}
                >
                  <Ban className="h-4 w-4" />
                  Revoke invite
                </Button>
              )}
              {onPromotePlayer && (
                <Button
                  variant="outline"
                  className="min-h-[44px] w-full justify-start gap-2 rounded-xl"
                  onClick={() => {
                    onPromotePlayer(morePlayer)
                    setMorePlayer(null)
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Move to another team
                </Button>
              )}
              {onDeletePlayer && (
                <Button
                  variant="outline"
                  className="min-h-[44px] w-full justify-start gap-2 rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => {
                    void onDeletePlayer(morePlayer)
                    setMorePlayer(null)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove from roster
                </Button>
              )}
              <Button variant="secondary" className="min-h-[44px] w-full rounded-xl" onClick={() => setMorePlayer(null)}>
                Close
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function RosterMobileSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 overflow-x-hidden md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex gap-3">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex justify-between gap-2">
                <div className="h-5 w-36 rounded bg-muted" />
                <div className="h-8 w-12 rounded-lg bg-muted" />
              </div>
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded-lg bg-muted" />
                <div className="h-6 w-20 rounded-lg bg-muted" />
              </div>
              <div className="flex gap-2 pt-2">
                <div className="h-11 flex-1 rounded-xl bg-muted" />
                <div className="h-11 flex-1 rounded-xl bg-muted" />
                <div className="h-11 flex-1 rounded-xl bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
