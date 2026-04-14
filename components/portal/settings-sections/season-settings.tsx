"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker, dateToYmd } from "@/components/portal/date-time-picker"
import { CalendarDays, Loader2 } from "lucide-react"

type LitePlayer = {
  id: string
  firstName: string
  lastName: string
  grade: number | null
  jerseyNumber: number | null
  positionGroup: string | null
}

interface Team {
  id: string
  seasonName: string
  rosterCap: number
}

interface SeasonSettingsProps {
  team: Team
}

/** Normalize DB grade to number or null */
function normalizeGrade(raw: unknown): number | null {
  if (raw == null || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Senior year: HS 12 or college year 4 */
function isSeniorGrade(grade: number | null): boolean {
  return grade === 12 || grade === 4
}

/** Default checkbox: seniors unchecked, everyone else checked */
function defaultRollingForGrade(grade: number | null): boolean {
  return !isSeniorGrade(grade)
}

/**
 * Group order: Seniors first → … → Freshmen; unknown last.
 * HS 9–12 and college 1–4 supported.
 */
function gradeGroupMeta(grade: number | null): { bucket: number; heading: string } {
  if (grade == null) return { bucket: 99, heading: "Grade not set" }
  if (grade >= 9 && grade <= 12) {
    const headings: Record<number, string> = {
      12: "Seniors",
      11: "Juniors",
      10: "Sophomores",
      9: "Freshmen",
    }
    return { bucket: 12 - grade, heading: headings[grade] ?? `Grade ${grade}` }
  }
  if (grade >= 1 && grade <= 4) {
    const headings: Record<number, string> = {
      4: "Seniors",
      3: "Juniors",
      2: "Sophomores",
      1: "Freshmen",
    }
    return { bucket: 4 - grade, heading: headings[grade] ?? `Year ${grade}` }
  }
  return { bucket: 50, heading: `Grade ${grade}` }
}

function sortPlayersForRollover(players: LitePlayer[]): LitePlayer[] {
  const out = [...players]
  out.sort((a, b) => {
    const ga = normalizeGrade(a.grade)
    const gb = normalizeGrade(b.grade)
    const ba = gradeGroupMeta(ga).bucket
    const bb = gradeGroupMeta(gb).bucket
    if (ba !== bb) return ba - bb
    const ln = (a.lastName || "").localeCompare(b.lastName || "", undefined, { sensitivity: "base" })
    if (ln !== 0) return ln
    return (a.firstName || "").localeCompare(b.firstName || "", undefined, { sensitivity: "base" })
  })
  return out
}

function groupPlayersByHeading(players: LitePlayer[]): { heading: string; players: LitePlayer[] }[] {
  const sorted = sortPlayersForRollover(players)
  const map = new Map<string, LitePlayer[]>()
  for (const p of sorted) {
    const g = normalizeGrade(p.grade)
    const { heading } = gradeGroupMeta(g)
    if (!map.has(heading)) map.set(heading, [])
    map.get(heading)!.push(p)
  }
  const order = ["Seniors", "Juniors", "Sophomores", "Freshmen", "Grade not set"]
  const seen = new Set<string>()
  const result: { heading: string; players: LitePlayer[] }[] = []
  for (const h of order) {
    const list = map.get(h)
    if (list?.length) {
      result.push({ heading: h, players: list })
      seen.add(h)
    }
  }
  for (const [heading, list] of map) {
    if (!seen.has(heading) && list.length) result.push({ heading, players: list })
  }
  return result
}

export function SeasonSettings({ team }: SeasonSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [rosterLoading, setRosterLoading] = useState(true)
  const [liteRoster, setLiteRoster] = useState<LitePlayer[]>([])
  const [rollingOver, setRollingOver] = useState<Record<string, boolean>>({})
  const rolloverSelectionInitializedRef = useRef(false)
  /** False until grade-based defaults are applied (avoids flash of all-checked before init). */
  const [rolloverSelectionReady, setRolloverSelectionReady] = useState(false)

  const [showRollover, setShowRollover] = useState(false)
  const [rolloverStep, setRolloverStep] = useState<1 | 2 | 3>(1)
  const [newSeasonName, setNewSeasonName] = useState("")
  const [newSeasonStart, setNewSeasonStart] = useState<Date | null>(null)

  const seasonEndDerived = useMemo(() => {
    if (!newSeasonStart) return null
    const d = new Date(newSeasonStart.getTime())
    d.setFullYear(d.getFullYear() + 1)
    return d
  }, [newSeasonStart])

  const [division, setDivision] = useState("")
  const [conference, setConference] = useState("")
  const [seasonLoading, setSeasonLoading] = useState(true)

  useEffect(() => {
    const loadSeasonData = async () => {
      try {
        const response = await fetch(`/api/teams/${team.id}/season`)
        if (response.ok) {
          const data = await response.json()
          if (data.season) {
            setDivision(data.season.division || "")
            setConference(data.season.conference || "")
          }
        }
      } catch (error) {
        console.error("Error loading season data:", error)
      } finally {
        setSeasonLoading(false)
      }
    }
    loadSeasonData()
  }, [team.id])

  const loadLiteRoster = useCallback(async () => {
    setRosterLoading(true)
    try {
      const res = await fetch(`/api/roster?teamId=${encodeURIComponent(team.id)}&lite=1`)
      if (!res.ok) {
        setLiteRoster([])
        return
      }
      const data = (await res.json()) as unknown
      const raw = Array.isArray(data) ? data : []
      const list: LitePlayer[] = raw.map((p: Record<string, unknown>) => ({
        id: String(p.id ?? ""),
        firstName: String(p.firstName ?? ""),
        lastName: String(p.lastName ?? ""),
        grade: normalizeGrade(p.grade),
        jerseyNumber: p.jerseyNumber != null ? Number(p.jerseyNumber) : null,
        positionGroup: p.positionGroup != null ? String(p.positionGroup) : null,
      }))
      setLiteRoster(list)
    } catch {
      setLiteRoster([])
    } finally {
      setRosterLoading(false)
    }
  }, [team.id])

  useEffect(() => {
    void loadLiteRoster()
  }, [loadLiteRoster])

  /** One-time grade-based defaults when a new rollover flow starts (roster must be loaded). */
  useEffect(() => {
    if (!showRollover) return
    if (liteRoster.length === 0) {
      setRolloverSelectionReady(true)
      return
    }
    if (rolloverSelectionInitializedRef.current) return
    const next: Record<string, boolean> = {}
    for (const p of liteRoster) {
      next[p.id] = defaultRollingForGrade(normalizeGrade(p.grade))
    }
    setRollingOver(next)
    rolloverSelectionInitializedRef.current = true
    setRolloverSelectionReady(true)
  }, [showRollover, liteRoster])

  const setPlayerRolling = (playerId: string, checked: boolean) => {
    setRollingOver((prev) => ({ ...prev, [playerId]: checked }))
  }

  const beginRolloverFlow = () => {
    rolloverSelectionInitializedRef.current = false
    setRolloverSelectionReady(false)
    setRollingOver({})
    setRolloverStep(1)
    setNewSeasonName("")
    setNewSeasonStart(null)
    setShowRollover(true)
  }

  const cancelRolloverFlow = () => {
    setShowRollover(false)
    setRolloverStep(1)
    rolloverSelectionInitializedRef.current = false
    setRolloverSelectionReady(false)
    setRollingOver({})
  }

  const handleSaveDivisionStanding = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}/season`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division: division.trim() || null,
          conference: conference.trim() || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update division/standing")
      }

      alert("Division and standing updated successfully!")
      window.location.reload()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Error updating division/standing")
    } finally {
      setLoading(false)
    }
  }

  const step1Complete = Boolean(newSeasonName.trim() && newSeasonStart)

  const handleSeasonRollover = async () => {
    if (!newSeasonName.trim() || !newSeasonStart || !seasonEndDerived) {
      alert("Please fill in all required fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/teams/rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          seasonName: newSeasonName.trim(),
          seasonStart: dateToYmd(newSeasonStart),
          seasonEnd: dateToYmd(seasonEndDerived),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to rollover season")
      }

      const result = await response.json()
      alert(`Season rolled over successfully! New team ID: ${result.newTeamId}`)
      window.location.href = `/dashboard?teamId=${result.newTeamId}`
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Error rolling over season")
    } finally {
      setLoading(false)
    }
  }

  const groupedRoster = useMemo(() => groupPlayersByHeading(liteRoster), [liteRoster])

  const returningPlayers = useMemo(() => {
    return liteRoster.filter((p) => rollingOver[p.id] !== false)
  }, [liteRoster, rollingOver])

  const notReturningPlayers = useMemo(() => {
    return liteRoster.filter((p) => rollingOver[p.id] === false)
  }, [liteRoster, rollingOver])

  const formatPreviewDate = (d: Date | null) =>
    d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Game schedule</CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage your team&apos;s games (add, edit, or import CSV) on the Schedule tab — not in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="border-border text-foreground">
            <Link href={`/dashboard/schedule?teamId=${encodeURIComponent(team.id)}`}>
              <CalendarDays className="mr-2 h-4 w-4" aria-hidden />
              Open Schedule
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Division & Standing */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Division & Standing</CardTitle>
          <CardDescription className="text-muted-foreground">
            Set your team&apos;s division and conference for the current season. This information appears on your dashboard header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {seasonLoading ? (
            <p className="text-muted-foreground">Loading season data...</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="division" className="text-foreground">Division (Optional)</Label>
                <Input
                  id="division"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="e.g., Division I, 5A, Class A"
                  className="bg-background border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Your team&apos;s division classification (e.g., &quot;5A&quot;, &quot;Division I&quot;)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conference" className="text-foreground">Conference (Optional)</Label>
                <Input
                  id="conference"
                  value={conference}
                  onChange={(e) => setConference(e.target.value)}
                  placeholder="e.g., Big 12, SEC, Metro Conference"
                  className="bg-background border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Your team&apos;s conference or league name
                </p>
              </div>
              <Button onClick={handleSaveDivisionStanding} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {loading ? "Saving..." : "Save Division & Standing"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roster Cap */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Roster cap</CardTitle>
          <CardDescription className="text-muted-foreground">
            Purchased roster slot limit for this team (read-only).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-foreground">Maximum active roster slots</Label>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {team.rosterCap > 0 ? team.rosterCap : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Contact support to change.</p>
          </div>
        </CardContent>
      </Card>

      {/* Season Rollover — 3-step workflow */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Season Rollover</CardTitle>
          <CardDescription className="text-muted-foreground">
            Create a new season and copy the roster. Use the steps below to enter new season details, choose returning players, then confirm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showRollover ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Current season: <span className="font-medium text-foreground">{team.seasonName}</span>
              </p>
              <Button onClick={beginRolloverFlow} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Start Season Rollover
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 text-sm border-b border-border pb-4">
                <li
                  className={
                    rolloverStep === 1
                      ? "font-semibold text-foreground"
                      : rolloverStep > 1
                        ? "text-muted-foreground"
                        : "text-muted-foreground"
                  }
                >
                  <span className="text-muted-foreground">1.</span> New season details
                </li>
                <li className="hidden sm:inline text-muted-foreground" aria-hidden>
                  →
                </li>
                <li
                  className={
                    rolloverStep === 2
                      ? "font-semibold text-foreground"
                      : rolloverStep > 2
                        ? "text-muted-foreground"
                        : "text-muted-foreground"
                  }
                >
                  <span className="text-muted-foreground">2.</span> Returning players
                </li>
                <li className="hidden sm:inline text-muted-foreground" aria-hidden>
                  →
                </li>
                <li className={rolloverStep === 3 ? "font-semibold text-foreground" : "text-muted-foreground"}>
                  <span className="text-muted-foreground">3.</span> Confirm rollover
                </li>
              </ol>

              {rolloverStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newSeasonName" className="text-foreground">New Season Name *</Label>
                    <Input
                      id="newSeasonName"
                      value={newSeasonName}
                      onChange={(e) => setNewSeasonName(e.target.value)}
                      placeholder="e.g., Fall 2025"
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    <DatePicker
                      id="newSeasonStart"
                      label="Season start *"
                      value={newSeasonStart}
                      onChange={setNewSeasonStart}
                      placeholder="Select start date"
                    />
                    <div className="space-y-2">
                      <Label className="text-foreground">Season end (one calendar year later)</Label>
                      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground min-h-[42px] flex items-center">
                        {seasonEndDerived ? (
                          <span className="tabular-nums">{formatPreviewDate(seasonEndDerived)}</span>
                        ) : (
                          <span className="text-muted-foreground">Select a start date first</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The end date is set automatically to exactly one calendar year after the start date (same month and day).
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={() => setRolloverStep(2)}
                      disabled={!step1Complete}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Next
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelRolloverFlow} className="border-border text-foreground">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {rolloverStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose who you expect to return for the new season. This is planning only — it does not remove anyone from the roster.
                    Seniors start unchecked; other grades start checked. Adjust as needed.
                  </p>
                  {rosterLoading || (liteRoster.length > 0 && !rolloverSelectionReady) ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading roster…
                    </div>
                  ) : liteRoster.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No players on the roster yet.</p>
                  ) : (
                    <div className="max-h-[min(420px,55vh)] space-y-4 overflow-y-auto pr-1">
                      {groupedRoster.map(({ heading, players }) => (
                        <div key={heading} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/80 pb-1">
                            {heading}
                          </p>
                          <div className="space-y-2">
                            {players.map((p) => {
                              const label = [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Player"
                              const sub = [p.jerseyNumber != null ? `#${p.jerseyNumber}` : null, p.positionGroup]
                                .filter(Boolean)
                                .join(" · ")
                              const checked = rollingOver[p.id] !== false
                              return (
                                <label
                                  key={p.id}
                                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm"
                                >
                                  <Checkbox
                                    className="mt-0.5 accent-primary"
                                    checked={checked}
                                    onCheckedChange={(c) => setPlayerRolling(p.id, c === true)}
                                    aria-label={`${label} returning`}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="font-medium text-foreground">{label}</span>
                                    {sub ? (
                                      <span className="block text-xs text-muted-foreground">{sub}</span>
                                    ) : null}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setRolloverStep(1)} className="border-border text-foreground">
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setRolloverStep(3)}
                      disabled={rosterLoading || (liteRoster.length > 0 && !rolloverSelectionReady)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {rolloverStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Season</h4>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">New season name</dt>
                        <dd className="font-medium text-foreground">{newSeasonName.trim() || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Season start</dt>
                        <dd className="font-medium text-foreground tabular-nums">{formatPreviewDate(newSeasonStart)}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">Season end (one year after start)</dt>
                        <dd className="font-medium text-foreground tabular-nums">{formatPreviewDate(seasonEndDerived)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Players</h4>
                    <p className="text-sm text-foreground">
                      <span className="font-medium tabular-nums">{returningPlayers.length}</span> returning
                      {" · "}
                      <span className="font-medium tabular-nums">{notReturningPlayers.length}</span> not returning
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Returning</p>
                        <ul className="text-sm text-foreground max-h-40 overflow-y-auto space-y-1 list-disc list-inside">
                          {returningPlayers.length === 0 ? (
                            <li className="list-none text-muted-foreground">None selected</li>
                          ) : (
                            returningPlayers.map((p) => (
                              <li key={p.id}>
                                {[p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Player"}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Not returning</p>
                        <ul className="text-sm text-foreground max-h-40 overflow-y-auto space-y-1 list-disc list-inside">
                          {notReturningPlayers.length === 0 ? (
                            <li className="list-none text-muted-foreground">None</li>
                          ) : (
                            notReturningPlayers.map((p) => (
                              <li key={p.id}>
                                {[p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Player"}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Note:</strong> Confirming will create a new team for the new season and copy all players as inactive.
                      You can then activate players as they confirm for the new season. Returning-player checkmarks here are for your planning record only in this workflow.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={handleSeasonRollover}
                      disabled={loading || !step1Complete || !seasonEndDerived}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {loading ? "Rolling over..." : "Confirm and rollover season"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setRolloverStep(2)} className="border-border text-foreground">
                      Back
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelRolloverFlow} className="border-border text-foreground">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
