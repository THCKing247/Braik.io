"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { WEEKLY_ENTRY_GAME_TYPES, WEEKLY_ENTRY_GAME_RESULTS } from "@/lib/stats-weekly-game-meta"
import { cn } from "@/lib/utils"

export interface BulkEditWeeklyStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  /** Entry IDs currently selected in the table. */
  selectedEntryIds: string[]
  /** All entry IDs currently visible after client-side filters (for “apply to all filtered”). */
  filteredEntryIds: string[]
  onSuccess: () => void
}

export function BulkEditWeeklyStatsDialog({
  open,
  onOpenChange,
  teamId,
  selectedEntryIds,
  filteredEntryIds,
  onSuccess,
}: BulkEditWeeklyStatsDialogProps) {
  const { showToast } = usePlaybookToast()
  const [applyAllFiltered, setApplyAllFiltered] = useState(false)
  const [opponent, setOpponent] = useState("")
  const [gameDate, setGameDate] = useState("")
  const [week, setWeek] = useState("")
  const [gameType, setGameType] = useState("")
  const [location, setLocation] = useState("")
  const [venue, setVenue] = useState("")
  const [result, setResult] = useState("")
  const [teamScore, setTeamScore] = useState("")
  const [opponentScore, setOpponentScore] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setApplyAllFiltered(false)
    setOpponent("")
    setGameDate("")
    setWeek("")
    setGameType("")
    setLocation("")
    setVenue("")
    setResult("")
    setTeamScore("")
    setOpponentScore("")
    setNotes("")
    setSaving(false)
  }, [open])

  const targetIds = useMemo(() => {
    if (applyAllFiltered) return filteredEntryIds
    return selectedEntryIds
  }, [applyAllFiltered, filteredEntryIds, selectedEntryIds])

  const targetCount = targetIds.length

  const buildUpdatesPayload = ():
    | { ok: true; updates: Record<string, unknown> }
    | { ok: false; message: string } => {
    const updates: Record<string, unknown> = {}
    const o = opponent.trim()
    if (o) updates.opponent = o
    const d = gameDate.trim()
    if (d) updates.date = d
    const w = week.trim()
    if (w) {
      const n = parseInt(w, 10)
      if (Number.isFinite(n) && n >= 1 && n <= 53) updates.week = n
    }
    const gt = gameType.trim().toLowerCase()
    if (gt) updates.game_type = gt
    const loc = location.trim()
    if (loc) updates.location = loc
    const ven = venue.trim()
    if (ven) updates.venue = ven
    const res = result.trim().toLowerCase()
    if (res) updates.result = res
    const ts = teamScore.trim()
    if (ts) {
      const n = Number(ts)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        return { ok: false, message: "Team score must be a non-negative whole number." }
      }
      updates.team_score = n
    }
    const os = opponentScore.trim()
    if (os) {
      const n = Number(os)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        return { ok: false, message: "Opponent score must be a non-negative whole number." }
      }
      updates.opponent_score = n
    }
    const nt = notes.trim()
    if (nt) updates.notes = nt
    if (Object.keys(updates).length === 0) {
      return { ok: false, message: "Fill in at least one field to apply." }
    }
    return { ok: true, updates }
  }

  const handleSave = async () => {
    if (targetCount === 0) {
      showToast("No rows to update.", "error")
      return
    }
    const built = buildUpdatesPayload()
    if (!built.ok) {
      showToast(built.message, "error")
      return
    }
    const { updates } = built

    setSaving(true)
    try {
      const res = await fetch("/api/stats/bulk-update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, ids: targetIds, updates }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(typeof data?.error === "string" ? data.error : "Update failed.", "error")
        return
      }
      const n = typeof data?.updated === "number" ? data.updated : targetCount
      showToast(`Updated ${n} record${n === 1 ? "" : "s"}`, "success")
      onSuccess()
      onOpenChange(false)
    } catch {
      showToast("Update failed.", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] w-full flex-col gap-0 overflow-hidden p-4 sm:p-6",
          "w-[min(100%,95vw)] max-w-[min(640px,95vw)]",
          "pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        )}
      >
        <DialogHeader className="shrink-0 pr-2">
          <DialogTitle>Bulk edit game info</DialogTitle>
          <DialogDescription>
            Only fields you fill in are applied. All other game fields stay as they are on each row.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden space-y-4 px-0.5">
          <div className="flex items-start gap-3 rounded-md border p-3" style={{ borderColor: "rgb(var(--border))" }}>
            <Checkbox
              id="bulk-apply-all-filtered"
              checked={applyAllFiltered}
              onCheckedChange={(c) => setApplyAllFiltered(c === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="bulk-apply-all-filtered" className="text-sm font-medium cursor-pointer">
                Apply to all filtered rows
              </Label>
              <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                When checked, updates every row visible in the table with current filters ({filteredEntryIds.length}{" "}
                row{filteredEntryIds.length === 1 ? "" : "s"}), not only the selection.
              </p>
            </div>
          </div>

          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            <span className="font-medium" style={{ color: "rgb(var(--text))" }}>
              {targetCount}
            </span>{" "}
            row{targetCount === 1 ? "" : "s"} will be updated.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bulk-opponent">Opponent</Label>
              <Input
                id="bulk-opponent"
                placeholder="Leave blank to keep existing"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-date">Game date</Label>
              <Input id="bulk-date" type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-week">Week</Label>
              <Input
                id="bulk-week"
                type="number"
                min={1}
                max={53}
                placeholder="e.g. 5"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-game-type">Game type</Label>
              <select
                id="bulk-game-type"
                className="mobile-select w-full"
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
              >
                <option value="">No change</option>
                {WEEKLY_ENTRY_GAME_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-location">Location</Label>
              <Input
                id="bulk-location"
                placeholder="Home, Away, Neutral…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bulk-venue">Venue (optional)</Label>
              <Input
                id="bulk-venue"
                placeholder="Stadium or site"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-result">Result</Label>
              <select
                id="bulk-result"
                className="mobile-select w-full"
                value={result}
                onChange={(e) => setResult(e.target.value)}
              >
                <option value="">No change</option>
                {WEEKLY_ENTRY_GAME_RESULTS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-team-score">Team score</Label>
              <Input
                id="bulk-team-score"
                type="number"
                min={0}
                placeholder="No change"
                value={teamScore}
                onChange={(e) => setTeamScore(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-opp-score">Opponent score</Label>
              <Input
                id="bulk-opp-score"
                type="number"
                min={0}
                placeholder="No change"
                value={opponentScore}
                onChange={(e) => setOpponentScore(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bulk-notes">Notes</Label>
              <textarea
                id="bulk-notes"
                className="mobile-select min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Leave blank to keep existing"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || targetCount === 0}>
            {saving ? "Applying…" : "Apply to rows"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
