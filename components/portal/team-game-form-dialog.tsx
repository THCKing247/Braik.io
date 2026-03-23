"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateTimePicker } from "@/components/portal/date-time-picker"
import { ConfirmDestructiveDialog } from "@/components/portal/confirm-destructive-dialog"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import {
  type TeamGameRow,
  inferHomeAway,
  locationDetailForEdit,
  buildLocationFromHomeAway,
} from "@/lib/team-schedule-games"

type HomeAway = "home" | "away" | "tbd"

function defaultKickoff(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(19, 0, 0, 0)
  return d
}

export function TeamGameFormDialog({
  teamId,
  open,
  onOpenChange,
  game,
  onSaved,
  suggestedOpponent,
}: {
  teamId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  game: TeamGameRow | null
  onSaved: () => void
  /** Hint when adding a game (e.g. last scheduled opponent). */
  suggestedOpponent?: string
}) {
  const { showToast } = usePlaybookToast()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [opponent, setOpponent] = useState("")
  const [kickoff, setKickoff] = useState<Date | null>(defaultKickoff)
  const [homeAway, setHomeAway] = useState<HomeAway>("tbd")
  const [locationDetail, setLocationDetail] = useState("")
  const [gameType, setGameType] = useState("regular")
  const [conferenceGame, setConferenceGame] = useState(false)
  const [result, setResult] = useState<string>("")
  const [teamScore, setTeamScore] = useState("")
  const [opponentScore, setOpponentScore] = useState("")
  const [notes, setNotes] = useState("")
  const [confirmedByCoach, setConfirmedByCoach] = useState(false)
  const [q1_home, setQ1_home] = useState("")
  const [q2_home, setQ2_home] = useState("")
  const [q3_home, setQ3_home] = useState("")
  const [q4_home, setQ4_home] = useState("")
  const [q1_away, setQ1_away] = useState("")
  const [q2_away, setQ2_away] = useState("")
  const [q3_away, setQ3_away] = useState("")
  const [q4_away, setQ4_away] = useState("")

  useEffect(() => {
    if (!open) return
    if (!game) {
      setOpponent("")
      setKickoff(defaultKickoff())
      setHomeAway("tbd")
      setLocationDetail("")
      setGameType("regular")
      setConferenceGame(false)
      setResult("")
      setTeamScore("")
      setOpponentScore("")
      setNotes("")
      setConfirmedByCoach(false)
      setQ1_home("")
      setQ2_home("")
      setQ3_home("")
      setQ4_home("")
      setQ1_away("")
      setQ2_away("")
      setQ3_away("")
      setQ4_away("")
      return
    }
    setOpponent(game.opponent || "")
    setKickoff(new Date(game.gameDate))
    const ha = inferHomeAway(game.location)
    setHomeAway(ha === "home" ? "home" : ha === "away" ? "away" : "tbd")
    setLocationDetail(locationDetailForEdit(game.location, ha))
    setGameType((game.gameType || "regular").toLowerCase())
    setConferenceGame(Boolean(game.conferenceGame))
    setResult(game.result || "")
    setTeamScore(game.teamScore != null ? String(game.teamScore) : "")
    setOpponentScore(game.opponentScore != null ? String(game.opponentScore) : "")
    setNotes(game.notes || "")
    setConfirmedByCoach(Boolean(game.confirmedByCoach))
    const qv = (n: number | null | undefined) => (n != null && Number.isFinite(Number(n)) ? String(n) : "")
    setQ1_home(qv(game.q1_home))
    setQ2_home(qv(game.q2_home))
    setQ3_home(qv(game.q3_home))
    setQ4_home(qv(game.q4_home))
    setQ1_away(qv(game.q1_away))
    setQ2_away(qv(game.q2_away))
    setQ3_away(qv(game.q3_away))
    setQ4_away(qv(game.q4_away))
  }, [open, game])

  const handleSubmit = async () => {
    const opp = opponent.trim()
    if (!opp || !kickoff) {
      showToast("Opponent and date/time are required.", "error")
      return
    }
    const location = buildLocationFromHomeAway(homeAway, locationDetail, opp)

    const qPayload = (s: string) => (s.trim() === "" ? null : Number(s))
    const payload = {
      opponent: opp,
      gameDate: kickoff.toISOString(),
      location,
      gameType,
      conferenceGame,
      result: result || null,
      teamScore: teamScore.trim() === "" ? null : Number(teamScore),
      opponentScore: opponentScore.trim() === "" ? null : Number(opponentScore),
      notes: notes.trim() || null,
      confirmedByCoach,
      q1_home: qPayload(q1_home),
      q2_home: qPayload(q2_home),
      q3_home: qPayload(q3_home),
      q4_home: qPayload(q4_home),
      q1_away: qPayload(q1_away),
      q2_away: qPayload(q2_away),
      q3_away: qPayload(q3_away),
      q4_away: qPayload(q4_away),
    }

    if (payload.teamScore !== null && Number.isNaN(payload.teamScore)) {
      showToast("Team score must be a number.", "error")
      return
    }
    if (payload.opponentScore !== null && Number.isNaN(payload.opponentScore)) {
      showToast("Opponent score must be a number.", "error")
      return
    }

    setSaving(true)
    try {
      if (!game) {
        const res = await fetch(`/api/teams/${teamId}/games`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error((j as { error?: string }).error || "Failed to create game")
        }
        showToast("Game added.", "success")
      } else {
        const res = await fetch(`/api/teams/${teamId}/games/${game.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error((j as { error?: string }).error || "Failed to update game")
        }
        showToast("Game updated.", "success")
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!game) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/games/${game.id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || "Failed to delete")
      }
      showToast("Game removed.", "success")
      setDeleteOpen(false)
      onOpenChange(false)
      onSaved()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{game ? "Edit game" : "Add game"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tg-opponent">Opponent</Label>
              <Input
                id="tg-opponent"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder={
                  !game && suggestedOpponent?.trim()
                    ? `e.g. ${suggestedOpponent.trim()}`
                    : "e.g. Central High"
                }
              />
            </div>

            <DateTimePicker
              id="tg-kickoff"
              label="Kickoff"
              value={kickoff}
              onChange={setKickoff}
            />

            <div className="space-y-2">
              <Label htmlFor="tg-ha">Home / Away</Label>
              <select
                id="tg-ha"
                value={homeAway}
                onChange={(e) => setHomeAway(e.target.value as HomeAway)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="tbd">Not specified</option>
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Stored in the location field (e.g. &quot;Home&quot; or &quot;@ opponent&quot;). Add a venue below if you like.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tg-loc">Venue / location detail</Label>
              <Input
                id="tg-loc"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder="Stadium name or city"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tg-type">Game type</Label>
              <select
                id="tg-type"
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="regular">Regular</option>
                <option value="playoff">Playoff</option>
                <option value="scrimmage">Scrimmage</option>
                <option value="tournament">Tournament</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={conferenceGame}
                onChange={(e) => setConferenceGame(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Conference game
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tg-res">Result</Label>
                <select
                  id="tg-res"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">— Not set —</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="tie">Tie</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tg-ts">Team score</Label>
                <Input
                  id="tg-ts"
                  inputMode="numeric"
                  value={teamScore}
                  onChange={(e) => setTeamScore(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tg-os">Opponent score</Label>
                <Input
                  id="tg-os"
                  inputMode="numeric"
                  value={opponentScore}
                  onChange={(e) => setOpponentScore(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Quarter breakdown (optional, venue home/away)</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">H Q1</Label>
                  <Input inputMode="numeric" value={q1_home} onChange={(e) => setQ1_home(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">H Q2</Label>
                  <Input inputMode="numeric" value={q2_home} onChange={(e) => setQ2_home(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">H Q3</Label>
                  <Input inputMode="numeric" value={q3_home} onChange={(e) => setQ3_home(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">H Q4</Label>
                  <Input inputMode="numeric" value={q4_home} onChange={(e) => setQ4_home(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">A Q1</Label>
                  <Input inputMode="numeric" value={q1_away} onChange={(e) => setQ1_away(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">A Q2</Label>
                  <Input inputMode="numeric" value={q2_away} onChange={(e) => setQ2_away(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">A Q3</Label>
                  <Input inputMode="numeric" value={q3_away} onChange={(e) => setQ3_away(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">A Q4</Label>
                  <Input inputMode="numeric" value={q4_away} onChange={(e) => setQ4_away(e.target.value)} className="h-9" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                If set, final scores follow the sum of quarters (mapped by home/away). Otherwise use team/opponent totals above.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tg-notes">Notes</Label>
              <textarea
                id="tg-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Postponement, injuries, etc."
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmedByCoach}
                onChange={(e) => setConfirmedByCoach(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Mark result as confirmed
            </label>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {game ? (
              <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setDeleteOpen(true)}>
                Delete game
              </Button>
            ) : (
              <span />
            )}
            <div className="flex w-full gap-2 sm:w-auto">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSubmit()}>
                {saving ? "Saving…" : game ? "Save" : "Add game"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDestructiveDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this game?"
        message="This removes the game from the schedule. Stat rows linked to this game may be unlinked."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isDeleting={deleting}
      />
    </>
  )
}
