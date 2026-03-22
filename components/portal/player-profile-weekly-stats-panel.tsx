"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AddWeeklyStatsDialog } from "@/components/portal/add-weekly-stats-dialog"
import { DeleteStatsConfirmDialog } from "@/components/portal/delete-stats-confirm-dialog"
import type { PlayerProfile } from "@/types/player-profile"
import type { PlayerStatsRow, StatsTableRow, WeeklyStatEntryApi } from "@/lib/stats-helpers"
import { toPlayerStatsRow, weeklyEntryToStatsTableRow } from "@/lib/stats-helpers"
import {
  STATS_PLAYER_TABLE_COLUMNS,
  STATS_WEEKLY_LEADING_COLUMNS,
  buildPlayerTableColumnsForKeys,
} from "@/lib/stats-display-columns"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

type GameOption = { id: string; opponent: string; gameDate: string; seasonYear: number | null }

const PROFILE_WEEKLY_COLUMNS_FULL = [
  ...STATS_WEEKLY_LEADING_COLUMNS,
  ...STATS_PLAYER_TABLE_COLUMNS.filter((c) => c.key !== "lastName"),
]

function buildProfileWeeklyColumns(visibleStatKeys: readonly (keyof PlayerStatsRow)[] | null | undefined) {
  if (visibleStatKeys && visibleStatKeys.length > 0) {
    return [...STATS_WEEKLY_LEADING_COLUMNS, ...buildPlayerTableColumnsForKeys(visibleStatKeys)]
  }
  return PROFILE_WEEKLY_COLUMNS_FULL
}

/** Match All Stats: horizontal + vertical scroll, thin visible scrollbars. */
const PROFILE_TABLE_SCROLL =
  "max-h-[min(65vh,560px)] max-w-full overflow-x-auto overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white [scrollbar-color:rgb(203_213_225)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90 [&::-webkit-scrollbar-track]:bg-transparent"

const STICKY_HEAD = "#F8FAFC"
const STICKY_ACTION_W_REM = 6

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
  visibleStatColumnKeys,
}: {
  teamId: string
  playerId: string
  profile: PlayerProfile
  canManage: boolean
  onAfterMutation: () => void
  /** Narrow table to these `PlayerStatsRow` keys (excl. week/game columns); full schema when omitted. */
  visibleStatColumnKeys?: readonly (keyof PlayerStatsRow)[] | null
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

  const profileWeeklyColumns = useMemo(
    () => buildProfileWeeklyColumns(visibleStatColumnKeys),
    [visibleStatColumnKeys]
  )

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
        <div className={PROFILE_TABLE_SCROLL}>
          <table className="min-w-max w-max border-collapse text-left text-sm">
            <thead className="sticky top-0 z-30">
              <tr className="border-b border-[#E5E7EB]">
                {canManage && (
                  <th
                    className="sticky left-0 z-[45] w-24 min-w-[6rem] px-2 py-2 text-center text-xs font-semibold text-[#64748B] shadow-[4px_0_8px_-2px_rgba(15,23,42,0.08)]"
                    style={{ backgroundColor: STICKY_HEAD }}
                  >
                    Actions
                  </th>
                )}
                {profileWeeklyColumns.map(({ key, label }) => {
                  const isWeek = key === "weekNumber"
                  const weekLeft = canManage ? STICKY_ACTION_W_REM : 0
                  return (
                    <th
                      key={key}
                      className={cn(
                        "whitespace-nowrap px-3 py-2 text-xs font-semibold text-[#64748B]",
                        isWeek &&
                          "sticky z-[45] min-w-[3.5rem] shadow-[4px_0_8px_-2px_rgba(15,23,42,0.08)]",
                        key === "gameLabel" && "min-w-[8rem]",
                        key === "gameOpponent" && "min-w-[7rem]",
                        key === "gameDate" && "min-w-[6.5rem]"
                      )}
                      style={
                        isWeek
                          ? { left: `${weekLeft}rem`, backgroundColor: STICKY_HEAD }
                          : { backgroundColor: STICKY_HEAD }
                      }
                    >
                      {label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const entry = entries.find((e) => e.id === row.rowKey)
                return (
                  <tr key={row.rowKey} className="group border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                    {canManage && (
                      <td
                        className="sticky left-0 z-20 bg-white px-2 py-2 text-center whitespace-nowrap shadow-[4px_0_6px_-3px_rgba(15,23,42,0.06)] group-hover:bg-[#F9FAFB]"
                      >
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
                    {profileWeeklyColumns.map(({ key }) => {
                      const isWeek = key === "weekNumber"
                      const weekLeft = canManage ? STICKY_ACTION_W_REM : 0
                      return (
                        <td
                          key={key}
                          className={cn(
                            "whitespace-nowrap px-3 py-2 text-[#0F172A]",
                            isWeek &&
                              "sticky z-20 min-w-[3.5rem] bg-white font-medium shadow-[4px_0_6px_-3px_rgba(15,23,42,0.06)] group-hover:bg-[#F9FAFB]"
                          )}
                          style={isWeek ? { left: `${weekLeft}rem` } : undefined}
                        >
                          {formatProfileWeeklyCell(row, key)}
                        </td>
                      )
                    })}
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
