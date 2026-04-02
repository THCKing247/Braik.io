"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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
  inferScheduleStatus,
  locationDetailForEdit,
  buildLocationFromHomeAway,
} from "@/lib/team-schedule-games"
import { cn } from "@/lib/utils"

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

  const isCreate = !game
  const showResultsSection = useMemo(
    () => Boolean(game && inferScheduleStatus(game) === "completed"),
    [game]
  )

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

  const buildSchedulePayload = () => {
    const opp = opponent.trim()
    if (!opp || !kickoff) {
      return null
    }
    const location = buildLocationFromHomeAway(homeAway, locationDetail, opp)
    return {
      opponent: opp,
      gameDate: kickoff.toISOString(),
      location,
      gameType,
      conferenceGame,
      notes: notes.trim() || null,
    }
  }

  const handleSubmit = async () => {
    const schedule = buildSchedulePayload()
    if (!schedule) {
      showToast("Opponent and date/time are required.", "error")
      return
    }

    const qPayload = (s: string) => (s.trim() === "" ? null : Number(s))
    const fullPayload = {
      ...schedule,
      result: result || null,
      teamScore: teamScore.trim() === "" ? null : Number(teamScore),
      opponentScore: opponentScore.trim() === "" ? null : Number(opponentScore),
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

    if (showResultsSection) {
      if (fullPayload.teamScore !== null && Number.isNaN(fullPayload.teamScore)) {
        showToast("Team score must be a number.", "error")
        return
      }
      if (fullPayload.opponentScore !== null && Number.isNaN(fullPayload.opponentScore)) {
        showToast("Opponent score must be a number.", "error")
        return
      }
    }

    setSaving(true)
    try {
      if (isCreate) {
        const res = await fetch(`/api/teams/${teamId}/games`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(schedule),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error((j as { error?: string }).error || "Failed to create game")
        }
        showToast("Game added.", "success")
      } else if (game) {
        const body = showResultsSection ? fullPayload : schedule
        const res = await fetch(`/api/teams/${teamId}/games/${game.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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

  const title = isCreate ? "Add game" : "Edit game"
  const description = isCreate
    ? "Schedule a game for your team. Record scores later under Game Results after the game is played."
    : showResultsSection
      ? "Update schedule details and final score for this completed game."
      : "Update when and where this game is played."

  const selectClass =
    "flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[min(92dvh,880px)] w-[calc(100vw-1.25rem)] max-w-4xl flex-col overflow-hidden p-0",
            "md:mx-4 md:max-w-4xl md:rounded-2xl"
          )}
        >
          <div className="shrink-0 border-b px-6 pb-4 pt-2 md:pt-4" style={{ borderColor: "rgb(var(--border))" }}>
            <DialogTitle className="text-2xl font-semibold tracking-tight">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-base leading-snug">{description}</DialogDescription>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-8">
              <section className="space-y-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--muted))" }}>
                  Game details
                </h3>
                <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="tg-opponent" className="text-sm font-medium">
                      Opponent
                    </Label>
                    <Input
                      id="tg-opponent"
                      className="h-11 rounded-lg"
                      value={opponent}
                      onChange={(e) => setOpponent(e.target.value)}
                      placeholder={
                        isCreate && suggestedOpponent?.trim()
                          ? `e.g. ${suggestedOpponent.trim()}`
                          : "e.g. Central High"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <DateTimePicker id="tg-kickoff" label="Date & time" value={kickoff} onChange={setKickoff} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tg-ha" className="text-sm font-medium">
                      Home / Away
                    </Label>
                    <select
                      id="tg-ha"
                      value={homeAway}
                      onChange={(e) => setHomeAway(e.target.value as HomeAway)}
                      className={selectClass}
                    >
                      <option value="tbd">Not specified</option>
                      <option value="home">Home</option>
                      <option value="away">Away</option>
                    </select>
                    <p className="text-xs leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
                      We store this in the location field (e.g. &quot;Home&quot; or &quot;@ opponent&quot;). Add a venue
                      below if you like.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tg-type" className="text-sm font-medium">
                      Game type
                    </Label>
                    <select
                      id="tg-type"
                      value={gameType}
                      onChange={(e) => setGameType(e.target.value)}
                      className={selectClass}
                    >
                      <option value="regular">Regular</option>
                      <option value="playoff">Playoff</option>
                      <option value="scrimmage">Scrimmage</option>
                      <option value="tournament">Tournament</option>
                    </select>
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="tg-loc" className="text-sm font-medium">
                      Venue / location detail
                    </Label>
                    <Input
                      id="tg-loc"
                      className="h-11 rounded-lg"
                      value={locationDetail}
                      onChange={(e) => setLocationDetail(e.target.value)}
                      placeholder="Stadium name or city"
                    />
                  </div>

                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 lg:col-span-2",
                      "transition-colors hover:bg-muted/40"
                    )}
                    style={{ borderColor: "rgb(var(--border))" }}
                  >
                    <input
                      type="checkbox"
                      checked={conferenceGame}
                      onChange={(e) => setConferenceGame(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                      Conference game
                    </span>
                  </label>
                </div>
              </section>

              <section className="space-y-2">
                <Label htmlFor="tg-notes" className="text-sm font-medium">
                  Notes
                </Label>
                <textarea
                  id="tg-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Logistics, weather, or other schedule notes — not for final scores."
                />
              </section>

              {showResultsSection ? (
                <section
                  className="space-y-5 rounded-xl border p-5 md:p-6"
                  style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--snow))" }}
                >
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
                      Final score & breakdown
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
                      For new games, add scores under <span className="font-medium">Game Results</span> on the schedule
                      page. This section appears for completed games when you need to correct an outcome here.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 lg:gap-x-8">
                    <div className="space-y-2">
                      <Label htmlFor="tg-res" className="text-sm font-medium">
                        Result
                      </Label>
                      <select
                        id="tg-res"
                        value={result}
                        onChange={(e) => setResult(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">— Not set —</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="tie">Tie</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:gap-8">
                    <div className="space-y-2">
                      <Label htmlFor="tg-ts" className="text-sm font-medium">
                        Team score
                      </Label>
                      <Input
                        id="tg-ts"
                        className="h-11 rounded-lg"
                        inputMode="numeric"
                        value={teamScore}
                        onChange={(e) => setTeamScore(e.target.value)}
                        placeholder="—"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tg-os" className="text-sm font-medium">
                        Opponent score
                      </Label>
                      <Input
                        id="tg-os"
                        className="h-11 rounded-lg"
                        inputMode="numeric"
                        value={opponentScore}
                        onChange={(e) => setOpponentScore(e.target.value)}
                        placeholder="—"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                      Quarter breakdown (optional, venue home/away)
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
                      {(
                        [
                          ["H Q1", q1_home, setQ1_home],
                          ["H Q2", q2_home, setQ2_home],
                          ["H Q3", q3_home, setQ3_home],
                          ["H Q4", q4_home, setQ4_home],
                          ["A Q1", q1_away, setQ1_away],
                          ["A Q2", q2_away, setQ2_away],
                          ["A Q3", q3_away, setQ3_away],
                          ["A Q4", q4_away, setQ4_away],
                        ] as const
                      ).map(([label, val, setVal]) => (
                        <div key={label} className="space-y-1.5">
                          <Label className="text-xs font-medium">{label}</Label>
                          <Input
                            inputMode="numeric"
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            className="h-10 rounded-lg"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
                      If set, final scores follow the sum of quarters (mapped by home/away). Otherwise use team and
                      opponent totals above.
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmedByCoach}
                      onChange={(e) => setConfirmedByCoach(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Mark result as confirmed
                  </label>
                </section>
              ) : null}
            </div>
          </div>

          <div
            className="shrink-0 border-t px-6 py-4"
            style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
          >
            <DialogFooter className="mt-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              {game ? (
                <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setDeleteOpen(true)}>
                  Delete game
                </Button>
              ) : (
                <span className="hidden sm:block sm:flex-1" />
              )}
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="h-11 min-w-[100px] px-6" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" className="h-11 min-w-[120px] px-6" disabled={saving} onClick={() => void handleSubmit()}>
                  {saving ? "Saving…" : game ? "Save changes" : "Add game"}
                </Button>
              </div>
            </DialogFooter>
          </div>
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
