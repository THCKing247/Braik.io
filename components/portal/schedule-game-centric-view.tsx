"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ChevronDown, ChevronRight, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { formatRecordLine } from "@/lib/records/compute-team-record"
import { emitTeamGamesChanged } from "@/lib/team-games-events"
import {
  type TeamGameRow,
  type WinLossRecord,
  buildCumulativeRecordBeforeMap,
  deriveGameOutcome,
  effectiveTotalsFromGame,
  groupGamesByScheduleWeek,
  inferHomeAway,
  inferScheduleStatus,
  getQuartersFromGame,
} from "@/lib/team-schedule-games"
import { hasAnyQuarterSet } from "@/lib/games-quarter-scoring"
import { cn } from "@/lib/utils"
import { computeTeamTrends } from "@/lib/schedule-team-trends"
import { ScheduleTeamTrendsStrip } from "@/components/portal/schedule-team-trends-strip"
import { ScheduleGameDetailTabs } from "@/components/portal/schedule-game-detail-tabs"

function WlBadge({ kind }: { kind: "W" | "L" | "T" | "—" }) {
  if (kind === "—") {
    return (
      <span
        className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums"
        style={{ backgroundColor: "rgb(var(--border))", color: "rgb(var(--muted))" }}
      >
        —
      </span>
    )
  }
  if (kind === "T") {
    return (
      <span
        className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums text-white"
        style={{ backgroundColor: "rgb(100 116 139)" }}
      >
        T
      </span>
    )
  }
  const win = kind === "W"
  return (
    <span
      className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums text-white"
      style={{
        backgroundColor: win ? "rgb(22 163 74)" : "rgb(220 38 38)",
      }}
    >
      {kind}
    </span>
  )
}

function RecordPill({ text }: { text: string }) {
  return (
    <span
      className="ml-1.5 inline-flex max-w-[5rem] truncate rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums md:max-w-none"
      style={{ backgroundColor: "rgb(var(--snow))", color: "rgb(var(--muted))" }}
    >
      {text}
    </span>
  )
}

function mapQuartersToSides(game: TeamGameRow, teamName: string, opponentLabel: string) {
  const q = getQuartersFromGame(game)
  const ha = inferHomeAway(game.location)
  const homePts = [q.q1_home, q.q2_home, q.q3_home, q.q4_home]
  const awayPts = [q.q1_away, q.q2_away, q.q3_away, q.q4_away]
  const weAreHome = ha !== "away"
  const ourLine = weAreHome ? homePts : awayPts
  const oppLine = weAreHome ? awayPts : homePts
  const ourName = teamName
  const oppName = opponentLabel || "Opponent"
  return { ourLine, oppLine, ourName, oppName }
}

export function ScheduleGameCentricView({
  teamId,
  teamName,
  games,
  canEdit,
  onRefresh,
  onEditGame,
}: {
  teamId: string
  teamName: string
  games: TeamGameRow[]
  canEdit: boolean
  onRefresh: () => void
  onEditGame: (g: TeamGameRow) => void
}) {
  const { showToast } = usePlaybookToast()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [scoreDraft, setScoreDraft] = useState<{ team: string; opp: string } | null>(null)
  const [scoreEditId, setScoreEditId] = useState<string | null>(null)
  const [qDraft, setQDraft] = useState<Record<string, string>>({})
  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(() => new Set())
  const [bulkScoresOpen, setBulkScoresOpen] = useState(false)
  const [bulkTeamInput, setBulkTeamInput] = useState("")
  const [bulkOppInput, setBulkOppInput] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)

  const recordBefore = useMemo(() => buildCumulativeRecordBeforeMap(games), [games])
  const allGameIds = useMemo(() => games.map((g) => g.id), [games])
  const weekGroups = useMemo(() => groupGamesByScheduleWeek(games), [games])
  const teamTrends = useMemo(() => computeTeamTrends(games), [games])

  const formatRec = (r: WinLossRecord) => formatRecordLine(r)

  const outcomeBadges = (game: TeamGameRow, eff: { team: number | null; opponent: number | null }) => {
    const st = inferScheduleStatus(game)
    if (st !== "completed") return { ours: "—" as const, opp: "—" as const }
    const g = { ...game, teamScore: eff.team, opponentScore: eff.opponent }
    const o = deriveGameOutcome(g)
    if (!o || o === "tie") {
      return { ours: o === "tie" ? ("T" as const) : ("—" as const), opp: o === "tie" ? ("T" as const) : ("—" as const) }
    }
    if (o === "win") return { ours: "W" as const, opp: "L" as const }
    return { ours: "L" as const, opp: "W" as const }
  }

  const patchScores = useCallback(
    async (gameId: string, teamScore: number | null, opponentScore: number | null) => {
      setSavingId(gameId)
      try {
        const res = await fetch(`/api/teams/${teamId}/games/${gameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamScore, opponentScore }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error((j as { error?: string }).error || "Update failed")
        }
        showToast("Scores updated.", "success")
        emitTeamGamesChanged(teamId)
        onRefresh()
        setScoreEditId(null)
        setScoreDraft(null)
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Update failed", "error")
      } finally {
        setSavingId(null)
      }
    },
    [onRefresh, showToast, teamId]
  )

  const patchQuarters = useCallback(
    async (game: TeamGameRow) => {
      const parse = (k: string) => {
        const v = qDraft[k]
        if (v === undefined || v.trim() === "") return null
        const n = Number(v)
        return Number.isFinite(n) ? Math.trunc(n) : null
      }
      const body = {
        q1_home: parse("q1_home"),
        q2_home: parse("q2_home"),
        q3_home: parse("q3_home"),
        q4_home: parse("q4_home"),
        q1_away: parse("q1_away"),
        q2_away: parse("q2_away"),
        q3_away: parse("q3_away"),
        q4_away: parse("q4_away"),
      }
      setSavingId(game.id)
      try {
        const res = await fetch(`/api/teams/${teamId}/games/${game.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error((j as { error?: string }).error || "Update failed")
        }
        showToast("Quarter breakdown saved.", "success")
        emitTeamGamesChanged(teamId)
        onRefresh()
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Update failed", "error")
      } finally {
        setSavingId(null)
      }
    },
    [onRefresh, qDraft, showToast, teamId]
  )

  const toggleGameSelected = useCallback((gameId: string) => {
    setSelectedGameIds((prev) => {
      const next = new Set(prev)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }, [])

  const applyBulkScores = useCallback(async () => {
    const ids = [...selectedGameIds]
    if (ids.length === 0) {
      showToast("Select at least one game.", "error")
      return
    }
    const ts =
      bulkTeamInput.trim() === "" ? null : Number(bulkTeamInput)
    const os =
      bulkOppInput.trim() === "" ? null : Number(bulkOppInput)
    if (ts != null && Number.isNaN(ts)) {
      showToast("Enter a valid team score.", "error")
      return
    }
    if (os != null && Number.isNaN(os)) {
      showToast("Enter a valid opponent score.", "error")
      return
    }
    setBulkSaving(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/games/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameIds: ids,
          teamScore: ts,
          opponentScore: os,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || "Bulk update failed")
      }
      const j = (await res.json().catch(() => ({}))) as { updated?: number }
      showToast(`Updated ${j.updated ?? ids.length} game(s).`, "success")
      emitTeamGamesChanged(teamId)
      onRefresh()
      setBulkScoresOpen(false)
      setSelectedGameIds(new Set())
      setBulkTeamInput("")
      setBulkOppInput("")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bulk update failed", "error")
    } finally {
      setBulkSaving(false)
    }
  }, [
    bulkOppInput,
    bulkTeamInput,
    onRefresh,
    selectedGameIds,
    showToast,
    teamId,
  ])

  useEffect(() => {
    if (!expandedId) return
    const g = games.find((x) => x.id === expandedId)
    if (!g) return
    const q = getQuartersFromGame(g)
    const next: Record<string, string> = {}
    ;(["q1_home", "q2_home", "q3_home", "q4_home", "q1_away", "q2_away", "q3_away", "q4_away"] as const).forEach((k) => {
      const v = q[k]
      next[k] = v != null && Number.isFinite(Number(v)) ? String(v) : ""
    })
    setQDraft(next)
  }, [expandedId, games])

  return (
    <div className="space-y-8">
      {games.length > 0 ? <ScheduleTeamTrendsStrip trends={teamTrends} /> : null}

      {canEdit && games.length > 0 ? (
        <div
          className="hidden lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:rounded-xl lg:border lg:px-4 lg:py-3"
          style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm" style={{ color: "rgb(var(--muted))" }}>
              <span className="font-semibold tabular-nums" style={{ color: "rgb(var(--text))" }}>
                {selectedGameIds.size}
              </span>{" "}
              selected
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={allGameIds.length === 0}
              onClick={() => {
                if (selectedGameIds.size === allGameIds.length) setSelectedGameIds(new Set())
                else setSelectedGameIds(new Set(allGameIds))
              }}
            >
              {selectedGameIds.size === allGameIds.length ? "Deselect all" : "Select all"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={selectedGameIds.size === 0}
              onClick={() => setSelectedGameIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={selectedGameIds.size === 0}
            onClick={() => setBulkScoresOpen(true)}
          >
            Bulk set scores
          </Button>
        </div>
      ) : null}

      <Dialog open={bulkScoresOpen} onOpenChange={setBulkScoresOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk set scores</DialogTitle>
            <DialogDescription>
              Applies the same final score to every selected game. Quarter breakdowns are cleared (same as editing
              scores on each card). Leave a field empty to clear that side&apos;s score.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-our-score">{teamName} (us)</Label>
              <Input
                id="bulk-our-score"
                inputMode="numeric"
                placeholder="e.g. 28"
                value={bulkTeamInput}
                onChange={(e) => setBulkTeamInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-opp-score">Opponent</Label>
              <Input
                id="bulk-opp-score"
                inputMode="numeric"
                placeholder="e.g. 14"
                value={bulkOppInput}
                onChange={(e) => setBulkOppInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setBulkScoresOpen(false)} disabled={bulkSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void applyBulkScores()} disabled={bulkSaving}>
              {bulkSaving ? "Saving…" : "Apply to selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {weekGroups.map((wg) => (
        <section key={wg.label} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide md:text-base" style={{ color: "rgb(var(--text))" }}>
            {wg.label}
          </h2>
          <div className="space-y-3">
            {wg.games.map((g) => {
              const eff = effectiveTotalsFromGame(g)
              const badges = outcomeBadges(g, eff)
              const rb = recordBefore.get(g.id) ?? { wins: 0, losses: 0, ties: 0 }
              const opp = g.opponent?.trim() || "TBD"
              const d = new Date(g.gameDate)
              const dateLine = Number.isFinite(d.getTime()) ? `${format(d, "EEE MMM d")} · ${format(d, "h:mm a")}` : "—"
              const expanded = expandedId === g.id
              const { ourLine, oppLine, ourName, oppName } = mapQuartersToSides(g, teamName, opp)
              const qRow = getQuartersFromGame(g)
              const homeVenueSum = [qRow.q1_home, qRow.q2_home, qRow.q3_home, qRow.q4_home].reduce(
                (s: number, n) => s + (n != null && Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : 0),
                0
              )
              const awayVenueSum = [qRow.q1_away, qRow.q2_away, qRow.q3_away, qRow.q4_away].reduce(
                (s: number, n) => s + (n != null && Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : 0),
                0
              )
              return (
                <div
                  key={g.id}
                  className="rounded-xl border px-3 py-3 shadow-sm md:px-4 md:py-4"
                  style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
                      {canEdit ? (
                        <div
                          className="hidden shrink-0 items-center gap-2 lg:flex"
                          onClick={(e) => e.stopPropagation()}
                          role="presentation"
                        >
                          <Checkbox
                            id={`schedule-select-${g.id}`}
                            checked={selectedGameIds.has(g.id)}
                            onCheckedChange={() => toggleGameSelected(g.id)}
                            aria-label={`Select game vs ${opp}`}
                          />
                        </div>
                      ) : null}
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <WlBadge kind={badges.ours} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-1">
                            <span className="truncate font-semibold" style={{ color: "rgb(var(--text))" }}>
                              {teamName}
                            </span>
                            <RecordPill text={`(${formatRec(rb)})`} />
                          </div>
                          <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                            {dateLine}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-center">
                        {canEdit && scoreEditId === g.id ? (
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Input
                              className="h-11 w-16 text-center text-lg font-bold tabular-nums"
                              inputMode="numeric"
                              value={scoreDraft?.team ?? ""}
                              onChange={(e) => setScoreDraft((s) => ({ team: e.target.value, opp: s?.opp ?? "" }))}
                              aria-label="Our score"
                            />
                            <span className="text-sm font-medium text-[rgb(var(--muted))]">vs</span>
                            <Input
                              className="h-11 w-16 text-center text-lg font-bold tabular-nums"
                              inputMode="numeric"
                              value={scoreDraft?.opp ?? ""}
                              onChange={(e) => setScoreDraft((s) => ({ team: s?.team ?? "", opp: e.target.value }))}
                              aria-label="Opponent score"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingId === g.id}
                              onClick={() => {
                                const ts = scoreDraft?.team.trim() === "" ? null : Number(scoreDraft?.team)
                                const os = scoreDraft?.opp.trim() === "" ? null : Number(scoreDraft?.opp)
                                if (ts != null && Number.isNaN(ts)) {
                                  showToast("Enter a valid team score.", "error")
                                  return
                                }
                                if (os != null && Number.isNaN(os)) {
                                  showToast("Enter a valid opponent score.", "error")
                                  return
                                }
                                void patchScores(g.id, ts, os)
                              }}
                            >
                              Save
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setScoreEditId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div
                              className="flex min-w-[3rem] items-center justify-center rounded-lg px-3 py-2 text-2xl font-bold tabular-nums md:min-w-[3.5rem] md:text-3xl"
                              style={{ backgroundColor: "rgb(var(--snow))", color: "rgb(var(--text))" }}
                            >
                              {eff.team != null ? eff.team : "—"}
                            </div>
                            <span className="text-sm font-semibold text-[rgb(var(--muted))]">vs</span>
                            <div
                              className="flex min-w-[3rem] items-center justify-center rounded-lg px-3 py-2 text-2xl font-bold tabular-nums md:min-w-[3.5rem] md:text-3xl"
                              style={{ backgroundColor: "rgb(var(--snow))", color: "rgb(var(--text))" }}
                            >
                              {eff.opponent != null ? eff.opponent : "—"}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:justify-end">
                        <div className="min-w-0 text-right">
                          <div className="flex flex-wrap items-baseline justify-end gap-x-1">
                            <span className="truncate font-semibold" style={{ color: "rgb(var(--text))" }}>
                              {opp}
                            </span>
                            <RecordPill text="(—)" />
                          </div>
                        </div>
                        <WlBadge kind={badges.opp} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 lg:border-t-0 lg:pt-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setExpandedId((id) => (id === g.id ? null : g.id))}
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        View breakdown
                      </Button>
                      {canEdit && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setScoreEditId(g.id)
                              setScoreDraft({
                                team: eff.team != null ? String(eff.team) : "",
                                opp: eff.opponent != null ? String(eff.opponent) : "",
                              })
                            }}
                          >
                            Edit scores
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => onEditGame(g)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Details
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <ScheduleGameDetailTabs
                      teamId={teamId}
                      teamName={teamName}
                      game={g}
                      weekLabel={wg.label}
                      canEdit={canEdit}
                      onRefresh={onRefresh}
                      gameTab={
                        <div className="space-y-4">
                          {canEdit && (
                            <>
                              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                                Quarter scoring (venue)
                              </p>
                              <div className="grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-4">
                                {(
                                  [
                                    "q1_home",
                                    "q2_home",
                                    "q3_home",
                                    "q4_home",
                                    "q1_away",
                                    "q2_away",
                                    "q3_away",
                                    "q4_away",
                                  ] as const
                                ).map((k) => (
                                  <div key={k} className="space-y-1">
                                    <label className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                                      {k.includes("home") ? "Home venue" : "Away venue"} · Q{k[1]}
                                    </label>
                                    <Input
                                      inputMode="numeric"
                                      value={qDraft[k] ?? ""}
                                      onChange={(e) => setQDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                                      className="h-9"
                                    />
                                  </div>
                                ))}
                              </div>
                              <Button type="button" size="sm" disabled={savingId === g.id} onClick={() => void patchQuarters(g)}>
                                Save breakdown
                              </Button>
                            </>
                          )}

                          <div
                            className={cn("rounded-lg border p-3", canEdit && "mt-2")}
                            style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--snow))" }}
                          >
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                              Scoring summary
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[360px] border-collapse text-center text-sm">
                                <thead>
                                  <tr>
                                    <th className="py-2 text-left font-medium" style={{ color: "rgb(var(--muted))" }}>
                                      Team
                                    </th>
                                    <th className="px-1 py-2 font-medium" style={{ color: "rgb(var(--muted))" }}>
                                      Q1
                                    </th>
                                    <th className="px-1 py-2 font-medium" style={{ color: "rgb(var(--muted))" }}>
                                      Q2
                                    </th>
                                    <th className="px-1 py-2 font-medium" style={{ color: "rgb(var(--muted))" }}>
                                      Q3
                                    </th>
                                    <th className="px-1 py-2 font-medium" style={{ color: "rgb(var(--muted))" }}>
                                      Q4
                                    </th>
                                    <th className="px-1 py-2 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="py-2 text-left font-medium" style={{ color: "rgb(var(--text))" }}>
                                      {ourName}
                                    </td>
                                    {ourLine.map((n, i) => (
                                      <td key={i} className="px-1 py-2 tabular-nums">
                                        {n ?? "—"}
                                      </td>
                                    ))}
                                    <td className="px-1 py-2 text-base font-bold tabular-nums">{eff.team ?? "—"}</td>
                                  </tr>
                                  <tr>
                                    <td className="py-2 text-left font-medium" style={{ color: "rgb(var(--text))" }}>
                                      {oppName}
                                    </td>
                                    {oppLine.map((n, i) => (
                                      <td key={i} className="px-1 py-2 tabular-nums">
                                        {n ?? "—"}
                                      </td>
                                    ))}
                                    <td className="px-1 py-2 text-base font-bold tabular-nums">{eff.opponent ?? "—"}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            {!hasAnyQuarterSet(qRow) && eff.team != null && eff.opponent != null && (
                              <p className="mt-2 text-xs" style={{ color: "rgb(var(--muted))" }}>
                                Totals from final score. Add a quarter breakdown above to see Q1–Q4 lines.
                              </p>
                            )}
                            {hasAnyQuarterSet(qRow) && (
                              <p className="mt-2 text-[11px] leading-snug" style={{ color: "rgb(var(--muted))" }}>
                                Venue check: home side {homeVenueSum} pts · away side {awayVenueSum} pts (stadium rows in DB).
                              </p>
                            )}
                          </div>
                        </div>
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
