"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PlayerStatsRow, WeeklyStatEntryApi } from "@/lib/stats-helpers"
import { SEASON_STAT_KEYS } from "@/lib/stats-helpers"
import { WEEKLY_FORM_SECTIONS } from "@/lib/stats-schema"
import { STAT_LABELS_BY_DB_KEY } from "@/lib/stats-import-fields"
import { DECIMAL_ALLOWED_STAT_KEYS, parseNonNegativeStatNumberFromString } from "@/lib/stats-weekly-api"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const FORM_DB_KEYS = SEASON_STAT_KEYS as readonly string[]

type QueueLine = {
  id: string
  playerId: string
  values: Record<string, string>
}

function emptyValues(): Record<string, string> {
  return Object.fromEntries(FORM_DB_KEYS.map((k) => [k, ""]))
}

/** Prefill edit form from weekly row JSON (canonical + legacy keys). */
function statsToFormValues(stats: Record<string, unknown>): Record<string, string> {
  const values = emptyValues()
  const s = stats && typeof stats === "object" ? stats : {}
  const get = (k: string) => {
    const v = s[k]
    if (v === undefined || v === null || v === "") return ""
    return String(v)
  }
  for (const k of FORM_DB_KEYS) {
    let raw = get(k)
    if (!raw && k === "passing_touchdowns") raw = get("passing_tds")
    if (!raw && k === "rushing_touchdowns") raw = get("rushing_tds")
    if (!raw && k === "receiving_touchdowns") raw = get("receiving_tds")
    if (!raw && k === "defensive_interceptions") raw = get("interceptions")
    if (!raw && k === "solo_tackles") {
      const st = get("solo_tackles")
      const ast = get("assisted_tackles")
      if (!st && !ast) raw = get("tackles")
      else if (st) raw = st
    }
    if (!raw && k === "assisted_tackles") raw = get("assisted_tackles")
    if (raw) values[k] = raw
  }
  return values
}

function newLine(): QueueLine {
  return { id: crypto.randomUUID(), playerId: "", values: emptyValues() }
}

type GameOption = { id: string; opponent: string; gameDate: string; seasonYear: number | null }

export interface AddWeeklyStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  roster: PlayerStatsRow[]
  seasonYear: string
  games: GameOption[]
  editEntry?: WeeklyStatEntryApi | null
  prefillPlayerId?: string | null
  /** Used to suggest next week/game # for new rows (count of existing entries per player). */
  weeklyEntriesForHints?: WeeklyStatEntryApi[] | null
  onSaved: () => void
}

export function AddWeeklyStatsDialog({
  open,
  onOpenChange,
  teamId,
  roster,
  seasonYear,
  games,
  editEntry = null,
  prefillPlayerId = null,
  weeklyEntriesForHints = null,
  onSaved,
}: AddWeeklyStatsDialogProps) {
  const isEdit = Boolean(editEntry)

  const weekNumberUserTouchedRef = useRef(false)

  const [seasonYearInput, setSeasonYearInput] = useState("")
  const [weekNumber, setWeekNumber] = useState("")
  const [gameId, setGameId] = useState("")
  const [opponent, setOpponent] = useState("")
  const [gameDate, setGameDate] = useState("")
  const [lines, setLines] = useState<QueueLine[]>(() => [newLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    weekNumberUserTouchedRef.current = false
    if (editEntry) {
      setSeasonYearInput(editEntry.seasonYear != null ? String(editEntry.seasonYear) : "")
      setWeekNumber(editEntry.weekNumber != null ? String(editEntry.weekNumber) : "")
      setGameId(editEntry.gameId ?? "")
      setOpponent(editEntry.opponent ?? "")
      setGameDate(editEntry.gameDate ? String(editEntry.gameDate).slice(0, 10) : "")
      const values = statsToFormValues(editEntry.stats)
      setLines([{ id: "edit", playerId: editEntry.playerId, values }])
    } else {
      setSeasonYearInput(seasonYear.trim() ? seasonYear : "")
      setWeekNumber("")
      setGameId("")
      setOpponent("")
      setGameDate("")
      const line = newLine()
      if (prefillPlayerId) line.playerId = prefillPlayerId
      setLines([line])
    }
  }, [open, editEntry, seasonYear, prefillPlayerId])

  useEffect(() => {
    if (!gameId) return
    if (editEntry && editEntry.gameId === gameId) return
    const g = games.find((x) => x.id === gameId)
    if (g) {
      setOpponent(g.opponent ?? "")
      if (g.gameDate) setGameDate(String(g.gameDate).slice(0, 10))
    }
  }, [gameId, games, editEntry])

  const seasonYearNum = useMemo(() => {
    const t = seasonYearInput.trim()
    if (!t) return null
    const y = parseInt(t, 10)
    return Number.isFinite(y) ? y : null
  }, [seasonYearInput])

  const weekNum = useMemo(() => {
    const w = parseInt(weekNumber, 10)
    return weekNumber.trim() === "" ? null : Number.isFinite(w) ? w : null
  }, [weekNumber])

  const applyAutoWeekForNewEntry = useCallback(
    (playerId: string) => {
      if (isEdit) return
      if (weekNumberUserTouchedRef.current) return
      if (!playerId) {
        setWeekNumber("")
        return
      }
      const hints = weeklyEntriesForHints ?? []
      let n = 0
      for (const e of hints) {
        if (e.playerId !== playerId) continue
        if (seasonYearNum != null && e.seasonYear !== seasonYearNum) continue
        n++
      }
      setWeekNumber(String(n + 1))
    },
    [isEdit, seasonYearNum, weeklyEntriesForHints]
  )

  useEffect(() => {
    if (!open || isEdit) return
    if (weekNumberUserTouchedRef.current) return
    const pid = lines.find((l) => l.playerId)?.playerId ?? ""
    applyAutoWeekForNewEntry(pid)
  }, [open, isEdit, lines, applyAutoWeekForNewEntry])

  const addLine = () => setLines((prev) => [...prev, newLine()])
  const removeLine = (id: string) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)))

  const setLinePlayer = (lineId: string, playerId: string) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, playerId } : l)))
  }

  const setLineStat = (lineId: string, key: string, value: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, values: { ...l.values, [key]: value } } : l))
    )
  }

  const parseStats = (values: Record<string, string>) => {
    const stats: Record<string, number> = {}
    for (const k of FORM_DB_KEYS) {
      const raw = values[k]?.trim() ?? ""
      if (raw === "") continue
      const n = parseNonNegativeStatNumberFromString(raw, k)
      if (n === null) {
        const kind = DECIMAL_ALLOWED_STAT_KEYS.has(k) ? "number" : "integer"
        throw new Error(`${STAT_LABELS_BY_DB_KEY[k] ?? k} must be a non-negative ${kind}`)
      }
      stats[k] = n
    }
    return stats
  }

  const handleSave = async () => {
    setError(null)

    if (isEdit && editEntry) {
      try {
        const stats = parseStats(lines[0]?.values ?? {})
        if (Object.keys(stats).length === 0) {
          throw new Error("Enter at least one stat value.")
        }
        setSaving(true)
        const res = await fetch("/api/stats/weekly", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            id: editEntry.id,
            season_year: seasonYearNum,
            week_number: weekNum,
            game_id: gameId.trim() ? gameId.trim() : null,
            opponent: opponent.trim() || null,
            game_date: gameDate.trim() || null,
            stats,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : "Update failed.")
          return
        }
        onSaved()
        onOpenChange(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed.")
      } finally {
        setSaving(false)
      }
      return
    }

    const entries: Array<{
      playerId: string
      seasonYear: number | null
      weekNumber: number | null
      gameId: string | null
      opponent: string | null
      gameDate: string | null
      stats: Record<string, number>
    }> = []

    try {
      for (const line of lines) {
        if (!line.playerId) {
          throw new Error("Each line needs a player.")
        }
        const stats = parseStats(line.values)
        if (Object.keys(stats).length === 0) {
          throw new Error("Enter at least one stat per line.")
        }
        entries.push({
          playerId: line.playerId,
          seasonYear: seasonYearNum,
          weekNumber: weekNum,
          gameId: gameId || null,
          opponent: opponent.trim() || null,
          gameDate: gameDate.trim() || null,
          stats,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your entries.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/stats/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, entries }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Save failed.")
        return
      }
      const nl = newLine()
      if (prefillPlayerId) nl.playerId = prefillPlayerId
      setLines([nl])
      setWeekNumber("")
      setGameId("")
      setOpponent("")
      setGameDate("")
      setSeasonYearInput(seasonYear.trim() ? seasonYear : "")
      onSaved()
      onOpenChange(false)
    } catch {
      setError("Save failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] w-full flex-col gap-0 overflow-hidden p-4 sm:p-6",
          "w-[min(100%,95vw)] max-w-[min(1100px,95vw)] md:max-w-[min(1100px,95vw)]",
          "pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        )}
      >
        <DialogHeader className="shrink-0 pr-2">
          <DialogTitle>{isEdit ? "Edit weekly / game stats" : "Add weekly / game stats"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this stat line. Season totals on the All Stats tab are recalculated from all weekly rows for this player."
              : "Set the game or week context once, then add one or more players and their numbers. Season totals sync from the sum of weekly rows."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0.5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="weekly-season-year">Season year (optional)</Label>
              <Input
                id="weekly-season-year"
                type="number"
                placeholder="e.g. 2025"
                value={seasonYearInput}
                onChange={(e) => setSeasonYearInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly-week">Week (optional)</Label>
              <Input
                id="weekly-week"
                type="number"
                min={1}
                max={30}
                placeholder="e.g. 5"
                value={weekNumber}
                onChange={(e) => {
                  weekNumberUserTouchedRef.current = true
                  setWeekNumber(e.target.value)
                }}
              />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="weekly-game-pick">Scheduled game (optional)</Label>
              <select
                id="weekly-game-pick"
                className="mobile-select w-full"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
              >
                <option value="">None — enter opponent/date manually</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.opponent ? `vs ${g.opponent}` : "Game"}{" "}
                    {g.gameDate ? `· ${String(g.gameDate).slice(0, 10)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="weekly-opponent">Opponent</Label>
              <Input
                id="weekly-opponent"
                placeholder="Opponent name"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="weekly-date">Game date</Label>
              <Input id="weekly-date" type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
              {isEdit ? "Player stats" : "Player lines"}
            </p>
            {!isEdit && !prefillPlayerId && (
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" aria-hidden />
                Add line
              </Button>
            )}
          </div>

          {lines.map((line) => (
            <div
              key={line.id}
              className="rounded-lg border p-3 space-y-3"
              style={{ borderColor: "rgb(var(--border))" }}
            >
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[12rem] space-y-1">
                  <Label>Player</Label>
                  <select
                    className="mobile-select w-full"
                    value={line.playerId}
                    onChange={(e) => setLinePlayer(line.id, e.target.value)}
                    disabled={isEdit || Boolean(prefillPlayerId)}
                  >
                    <option value="">Select player</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.jerseyNumber ?? "—"} {p.firstName} {p.lastName} ({p.position ?? "—"})
                      </option>
                    ))}
                  </select>
                </div>
                {!isEdit && !prefillPlayerId && lines.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    aria-label="Remove line"
                    onClick={() => removeLine(line.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {WEEKLY_FORM_SECTIONS.map((section) => (
                  <details
                    key={section.id}
                    open
                    className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--snow))]/40 px-3 py-2"
                  >
                    <summary className="cursor-pointer select-none text-sm font-semibold text-[rgb(var(--text))] py-1">
                      {section.label}
                    </summary>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pt-3 pb-1">
                      {section.keys.map((key) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs font-normal" htmlFor={`${line.id}-${key}`}>
                            {STAT_LABELS_BY_DB_KEY[key] ?? key}
                          </Label>
                          <Input
                            id={`${line.id}-${key}`}
                            inputMode="numeric"
                            placeholder="—"
                            value={line.values[key] ?? ""}
                            onChange={(e) => setLineStat(line.id, key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
          </div>

          {error && <p className="text-sm text-red-700 pt-3">{error}</p>}
        </div>

        <DialogFooter className="mt-4 shrink-0 border-t border-[rgb(var(--border))] bg-[rgb(var(--snow))]/50 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save entries"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
