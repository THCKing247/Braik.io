"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PlayerStatsRow, WeeklyStatEntryApi } from "@/lib/stats-helpers"
import { STAT_IMPORT_FIELDS, STAT_LABELS_BY_DB_KEY } from "@/lib/stats-import-fields"
import { Plus, Trash2 } from "lucide-react"

const EXTRA_KEYS = ["receptions"] as const

const FORM_DB_KEYS = [...new Set([...STAT_IMPORT_FIELDS.map((f) => f.dbKey), ...EXTRA_KEYS])]

type QueueLine = {
  id: string
  playerId: string
  values: Record<string, string>
}

function emptyValues(): Record<string, string> {
  return Object.fromEntries(FORM_DB_KEYS.map((k) => [k, ""]))
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
  /** When set, dialog edits this entry (single row). */
  editEntry?: WeeklyStatEntryApi | null
  /** Roster profile: new entry is for this player only (player field locked). */
  prefillPlayerId?: string | null
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
  onSaved,
}: AddWeeklyStatsDialogProps) {
  const isEdit = Boolean(editEntry)

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
    if (editEntry) {
      setSeasonYearInput(editEntry.seasonYear != null ? String(editEntry.seasonYear) : "")
      setWeekNumber(editEntry.weekNumber != null ? String(editEntry.weekNumber) : "")
      setGameId(editEntry.gameId ?? "")
      setOpponent(editEntry.opponent ?? "")
      setGameDate(editEntry.gameDate ? String(editEntry.gameDate).slice(0, 10) : "")
      const values = emptyValues()
      for (const k of FORM_DB_KEYS) {
        const v = editEntry.stats[k]
        if (v !== undefined && v !== null && v !== "") values[k] = String(v)
      }
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
      const n = parseInt(raw, 10)
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid value for ${STAT_LABELS_BY_DB_KEY[k] ?? k}`)
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
      setLines([newLine()])
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
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit weekly / game stats" : "Add weekly / game stats"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this stat line. Season totals on the All Stats tab are recalculated from all weekly rows for this player."
              : "Set the game or week context once, then add one or more players and their numbers. Season totals sync from the sum of weekly rows."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
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
              onChange={(e) => setWeekNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="weekly-opponent">Opponent</Label>
            <Input
              id="weekly-opponent"
              placeholder="Opponent name"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="weekly-date">Game date</Label>
            <Input id="weekly-date" type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3 pt-2">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FORM_DB_KEYS.map((key) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs font-normal" htmlFor={`${line.id}-${key}`}>
                      {key === "receptions" ? "Receptions" : (STAT_LABELS_BY_DB_KEY[key] ?? key)}
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
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <DialogFooter>
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
