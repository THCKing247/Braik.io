"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AddWeeklyStatsDialog } from "@/components/portal/add-weekly-stats-dialog"
import { DeleteStatsConfirmDialog } from "@/components/portal/delete-stats-confirm-dialog"
import type { PlayerProfile } from "@/types/player-profile"
import type { PlayerStatsRow, StatsTableRow, WeeklyStatEntryApi } from "@/lib/stats-helpers"
import { toPlayerStatsRow, weeklyEntryToStatsTableRow } from "@/lib/stats-helpers"
import { STATS_PLAYER_TABLE_COLUMNS, STATS_WEEKLY_LEADING_COLUMNS } from "@/lib/stats-display-columns"
import { Pencil, Plus, Trash2 } from "lucide-react"

type GameOption = { id: string; opponent: string; gameDate: string; seasonYear: number | null }

const PROFILE_WEEKLY_COLUMNS = [
  ...STATS_WEEKLY_LEADING_COLUMNS,
  ...STATS_PLAYER_TABLE_COLUMNS.filter((c) => c.key !== "lastName"),
]

const SCROLL =
  "overflow-x-auto max-w-full rounded-lg border border-[#E5E7EB] bg-white [-ms-overflow-style:none] [scrollbar-width:thin]"

function formatProfileWeeklyCell(row: StatsTableRow, key: keyof StatsTableRow): string {
  if (key === "weekNumber") {
    const v = row.weekNumber
    return v === null || v === undefined ? "—" : String(v)
  }
  if (key === "gameLabel") {
    const v = row.gameLabel
    return v === null || v === undefined || v === "" ? "—" : String(v)
  }
  if (key === "gameOpponent") {
    const v = row.gameOpponent
    return v === null || v === undefined || v === "" ? "—" : String(v)
  }
  if (key === "gameDate") {
    const v = row.gameDate
    if (v === null || v === undefined || v === "") return "—"
    return String(v).slice(0, 10)
  }
  const v = row[key as keyof PlayerStatsRow]
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return String(v)
}

export function PlayerProfileWeeklyStatsPanel({
  teamId,
  playerId,
  profile,
  canManage,
  onAfterMutation,
}: {
  teamId: string
  playerId: string
  profile: PlayerProfile
  canManage: boolean
  onAfterMutation: () => void
}) {
  const [entries, setEntries] = useState<WeeklyStatEntryApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [games, setGames] = useState<GameOption[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<WeeklyStatEntryApi | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<WeeklyStatEntryApi | null>(null)

  const seasonYearDefault = useMemo(() => String(new Date().getFullYear()), [])

  const loadWeekly = useCallback(() => {
    if (!teamId || !playerId) return
    setLoading(true)
    setError(null)
    const q = new URLSearchParams({ teamId, playerId })
    fetch(`/api/stats/weekly?${q.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Access denied" : "Failed to load weekly stats")
        return res.json()
      })
      .then((data: { entries?: WeeklyStatEntryApi[] }) => {
        setEntries(Array.isArray(data?.entries) ? data.entries : [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [teamId, playerId])

  useEffect(() => {
    loadWeekly()
  }, [loadWeekly])

  useEffect(() => {
    if (!canManage || !teamId) return
    let cancelled = false
    fetch(`/api/stats/games?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("games"))))
      .then((data: { games?: GameOption[] }) => {
        if (!cancelled && Array.isArray(data?.games)) setGames(data.games)
      })
      .catch(() => {
        if (!cancelled) setGames([])
      })
    return () => {
      cancelled = true
    }
  }, [teamId, canManage])

  const rosterOne: PlayerStatsRow[] = useMemo(() => {
    return [
      toPlayerStatsRow({
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        jerseyNumber: profile.jerseyNumber ?? null,
        positionGroup: profile.position ?? null,
        seasonStats:
          profile.seasonStats && typeof profile.seasonStats === "object"
            ? (profile.seasonStats as Record<string, unknown>)
            : {},
      }),
    ]
  }, [profile])

  const tableRows = useMemo(() => entries.map(weeklyEntryToStatsTableRow), [entries])

  const openDelete = (entry: WeeklyStatEntryApi) => {
    setPendingDeleteEntry(entry)
    setDeleteError(null)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteEntry) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch("/api/stats/weekly", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, ids: [pendingDeleteEntry.id] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(typeof data?.error === "string" ? data.error : "Delete failed")
        return
      }
      setDeleteOpen(false)
      setPendingDeleteEntry(null)
      loadWeekly()
      onAfterMutation()
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleSaved = () => {
    loadWeekly()
    onAfterMutation()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label className="text-[#0F172A] font-medium">Weekly / game stats</Label>
          <p className="mt-1 text-xs text-[#64748B]">
            Each row is one game or week. Season totals above are summed from these lines.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-[#E5E7EB]"
            onClick={() => {
              setEditEntry(null)
              setAddOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" aria-hidden />
            Add weekly / game stat
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#64748B]">Loading stat lines…</p>
      ) : tableRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-8 text-center">
          <p className="text-sm text-[#64748B]">No weekly or game stat lines yet.</p>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className="mt-4"
              onClick={() => {
                setEditEntry(null)
                setAddOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden />
              Add weekly / game stat
            </Button>
          ) : (
            <p className="mt-2 text-xs text-[#94A3B8]">Ask a coach to add stat entries from this profile or the team Stats page.</p>
          )}
        </div>
      ) : (
        <div className={SCROLL}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#F8FAFC]">
              <tr className="border-b border-[#E5E7EB]">
                {canManage && (
                  <th className="w-24 px-2 py-2 text-center text-xs font-semibold text-[#64748B]">Actions</th>
                )}
                {PROFILE_WEEKLY_COLUMNS.map(({ key, label }) => (
                  <th key={key} className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-[#64748B]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const entry = entries.find((e) => e.id === row.rowKey)
                return (
                  <tr key={row.rowKey} className="border-b border-[#E5E7EB] last:border-0">
                    {canManage && (
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit stat line"
                          disabled={!entry}
                          onClick={() => {
                            if (entry) {
                              setEditEntry(entry)
                              setAddOpen(true)
                            }
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600"
                          aria-label="Delete stat line"
                          disabled={!entry}
                          onClick={() => entry && openDelete(entry)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </td>
                    )}
                    {PROFILE_WEEKLY_COLUMNS.map(({ key }) => (
                      <td key={key} className="whitespace-nowrap px-3 py-2 text-[#0F172A]">
                        {formatProfileWeeklyCell(row, key)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddWeeklyStatsDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) setEditEntry(null)
        }}
        teamId={teamId}
        roster={rosterOne}
        seasonYear={seasonYearDefault}
        games={games}
        editEntry={editEntry}
        prefillPlayerId={editEntry ? null : playerId}
        onSaved={handleSaved}
      />

      <DeleteStatsConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o)
          if (!o) {
            setPendingDeleteEntry(null)
            setDeleteError(null)
          }
        }}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        errorMessage={deleteError}
        confirmMode="soft_delete_weekly"
      />
    </div>
  )
}
