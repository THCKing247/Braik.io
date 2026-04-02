"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { ScheduleGameListSkeleton } from "@/components/portal/dashboard-route-skeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  type TeamGameRow,
  buildCumulativeRecordBeforeMap,
  parseGameDateMs,
  partitionGamesForScheduleTabs,
} from "@/lib/team-schedule-games"
import { computeTeamTrends } from "@/lib/schedule-team-trends"
import { cn } from "@/lib/utils"
import { ListOrdered, Plus, Upload, Download } from "lucide-react"
import { emitTeamGamesChanged, TEAM_GAMES_CHANGED_EVENT } from "@/lib/team-games-events"
import {
  fetchTeamGamesForRange,
  SCHEDULE_TEAM_GAMES_STALE_MS,
  teamGamesQueryKey,
} from "@/lib/stats/fetch-team-games-client"
import { getScheduleGamesWindows } from "@/lib/stats/schedule-games-windows"

const ScheduleGameCentricView = dynamic(
  () =>
    import("@/components/portal/schedule-game-centric-view").then((m) => m.ScheduleGameCentricView),
  { loading: () => <div className="min-h-[200px] animate-pulse rounded-lg bg-muted" aria-hidden /> }
)

const TeamGameFormDialog = dynamic(
  () => import("@/components/portal/team-game-form-dialog").then((m) => m.TeamGameFormDialog),
  { loading: () => null }
)

const TeamGamesImportDialog = dynamic(
  () => import("@/components/portal/team-games-import-dialog").then((m) => m.TeamGamesImportDialog),
  { loading: () => null }
)

export default function TeamSchedulePage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => <TeamScheduleContent teamId={teamId} canEdit={canEdit} />}
    </DashboardPageShell>
  )
}

function mergeScheduleGamesFromQueries(results: { data?: { games?: TeamGameRow[] } }[]): TeamGameRow[] {
  const map = new Map<string, TeamGameRow>()
  for (const r of results) {
    for (const g of r.data?.games ?? []) {
      map.set(g.id, g)
    }
  }
  return [...map.values()].sort((a, b) => parseGameDateMs(a.gameDate) - parseGameDateMs(b.gameDate))
}

function downloadScheduleCsv(games: TeamGameRow[], filenameSuffix: string) {
  const header = "opponent,game_date,location,game_type,conference_game,notes"
  const lines = games.map((g) => {
    const d = new Date(g.gameDate)
    const iso = Number.isFinite(d.getTime()) ? d.toISOString() : ""
    const loc = (g.location ?? "").replace(/"/g, '""')
    const opp = (g.opponent ?? "").replace(/"/g, '""')
    const gt = (g.gameType ?? "").replace(/"/g, '""')
    const notes = (g.notes ?? "").replace(/"/g, '""')
    const conf = g.conferenceGame ? "true" : "false"
    return `"${opp}","${iso}","${loc}","${gt}",${conf},"${notes}"`
  })
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `game-schedule-${filenameSuffix}-${format(new Date(), "yyyy-MM-dd")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function TeamScheduleContent({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const windowsRef = useRef(getScheduleGamesWindows())
  const { prev, main, next } = windowsRef.current

  const [teamName, setTeamName] = useState<string>("Your team")
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<TeamGameRow | null>(null)
  const [scheduleTab, setScheduleTab] = useState<"schedule" | "results">("schedule")

  const rangeQueries = useQueries({
    queries: [
      {
        queryKey: teamGamesQueryKey(teamId, prev.startIso, prev.endIso),
        queryFn: () => fetchTeamGamesForRange(teamId, prev.startIso, prev.endIso),
        enabled: Boolean(teamId),
        staleTime: SCHEDULE_TEAM_GAMES_STALE_MS,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
      {
        queryKey: teamGamesQueryKey(teamId, main.startIso, main.endIso),
        queryFn: () => fetchTeamGamesForRange(teamId, main.startIso, main.endIso),
        enabled: Boolean(teamId),
        staleTime: SCHEDULE_TEAM_GAMES_STALE_MS,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
      {
        queryKey: teamGamesQueryKey(teamId, next.startIso, next.endIso),
        queryFn: () => fetchTeamGamesForRange(teamId, next.startIso, next.endIso),
        enabled: Boolean(teamId),
        staleTime: SCHEDULE_TEAM_GAMES_STALE_MS,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    ],
  })

  const gamesLoading = rangeQueries.some((q) => q.isPending)
  const gamesError = rangeQueries.some((q) => q.isError)

  const games = useMemo(() => mergeScheduleGamesFromQueries(rangeQueries), [rangeQueries])

  const refreshGames = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["games", teamId] })
  }, [queryClient, teamId])

  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ teamId?: string }>
      if (ce.detail?.teamId === teamId) {
        void queryClient.invalidateQueries({ queryKey: ["games", teamId] })
      }
    }
    window.addEventListener(TEAM_GAMES_CHANGED_EVENT, handler as EventListener)
    return () => window.removeEventListener(TEAM_GAMES_CHANGED_EVENT, handler as EventListener)
  }, [queryClient, teamId])

  useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(() => {
      fetch(`/api/teams/${encodeURIComponent(teamId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { name?: string } | null) => {
          if (!cancelled && data?.name) setTeamName(data.name)
        })
        .catch(() => {})
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [teamId])

  const onSaved = useCallback(() => {
    refreshGames()
    router.refresh()
    emitTeamGamesChanged(teamId)
  }, [refreshGames, router, teamId])

  const orderedGames = games

  const { scheduleGames, resultsGames } = useMemo(
    () => partitionGamesForScheduleTabs(orderedGames),
    [orderedGames]
  )

  const recordBeforeFull = useMemo(() => buildCumulativeRecordBeforeMap(orderedGames), [orderedGames])

  const teamTrendsFull = useMemo(() => computeTeamTrends(orderedGames), [orderedGames])

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (g: TeamGameRow) => {
    setEditing(g)
    setFormOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-10 pt-2 md:px-6 lg:px-0">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl" style={{ color: "rgb(var(--text))" }}>
          Schedule
        </h1>
        <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
          Team games only. Practices, meetings, and other events live in{" "}
          <Link href="/dashboard/calendar" className="font-medium text-[rgb(var(--accent))] underline-offset-2 hover:underline">
            Calendar
          </Link>
          .
        </p>
        {canEdit && (
          <p className="mt-2 text-sm font-medium" style={{ color: "rgb(var(--text2))" }}>
            Use Game Schedule for upcoming games and imports; use Game Results for scores and outcomes.
          </p>
        )}
      </div>

      <div
        className="flex w-full max-w-lg rounded-xl border p-1 shadow-sm"
        style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--snow))" }}
        role="tablist"
        aria-label="Schedule and results"
      >
        <button
          type="button"
          role="tab"
          id="schedule-tab-schedule"
          aria-selected={scheduleTab === "schedule"}
          aria-controls="schedule-panel-schedule"
          className={cn(
            "min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold transition-colors",
            scheduleTab === "schedule"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/80"
          )}
          onClick={() => setScheduleTab("schedule")}
        >
          Game Schedule
        </button>
        <button
          type="button"
          role="tab"
          id="schedule-tab-results"
          aria-selected={scheduleTab === "results"}
          aria-controls="schedule-panel-results"
          className={cn(
            "min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold transition-colors",
            scheduleTab === "results"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/80"
          )}
          onClick={() => setScheduleTab("results")}
        >
          Game Results
        </button>
      </div>

      {canEdit && scheduleTab === "schedule" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={openAdd}>
            <Plus className="h-4 w-4" aria-hidden />
            Add game
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" aria-hidden />
            Upload schedule
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={scheduleGames.length === 0}
            onClick={() => downloadScheduleCsv(scheduleGames, "upcoming")}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        </div>
      )}

      <Card
        className="overflow-hidden border-0 shadow-sm ring-1 ring-black/[0.05] md:border md:ring-0"
        style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
        id={scheduleTab === "schedule" ? "schedule-panel-schedule" : "schedule-panel-results"}
        role="tabpanel"
        aria-labelledby={scheduleTab === "schedule" ? "schedule-tab-schedule" : "schedule-tab-results"}
      >
        <CardHeader className="flex flex-row items-center gap-2 px-4 pb-2 pt-4 md:px-6">
          <ListOrdered className="h-5 w-5 shrink-0" style={{ color: "rgb(var(--accent))" }} aria-hidden />
          <CardTitle className="text-base font-semibold md:text-lg" style={{ color: "rgb(var(--text))" }}>
            {scheduleTab === "schedule" ? "Game schedule" : "Game results"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-4 md:px-6 md:pb-6">
          {gamesError ? (
            <div className="px-4 py-8 text-center md:px-0">
              <p className="text-sm font-medium text-red-600">Couldn&apos;t load games. Try again.</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => refreshGames()}>
                Retry
              </Button>
            </div>
          ) : gamesLoading ? (
            <ScheduleGameListSkeleton rows={8} />
          ) : scheduleTab === "schedule" ? (
            orderedGames.length === 0 ? (
              <div className="px-4 py-10 text-center md:px-0">
                <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                  No games scheduled yet.
                </p>
                {canEdit ? (
                  <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                    <Button type="button" size="sm" onClick={openAdd}>
                      <Plus className="h-4 w-4 mr-2" aria-hidden />
                      Add your first game
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" aria-hidden />
                      Upload schedule (CSV)
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
                    Your coaches will post games here when they&apos;re ready.
                  </p>
                )}
              </div>
            ) : scheduleGames.length === 0 ? (
              <div className="px-4 py-10 text-center md:px-0">
                <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                  No upcoming games on the calendar.
                </p>
                <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
                  Past games and scores are under Game Results.
                </p>
                {canEdit ? (
                  <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                    <Button type="button" size="sm" onClick={openAdd}>
                      <Plus className="h-4 w-4 mr-2" aria-hidden />
                      Add game
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" aria-hidden />
                      Upload schedule (CSV)
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <ScheduleGameCentricView
                teamId={teamId}
                teamName={teamName}
                games={scheduleGames}
                canEdit={canEdit}
                onRefresh={refreshGames}
                onEditGame={(g) => openEdit(g)}
                recordBeforeMap={recordBeforeFull}
                teamTrends={teamTrendsFull}
                surface="schedule"
              />
            )
          ) : resultsGames.length === 0 ? (
            <div className="px-4 py-10 text-center md:px-0">
              <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                No game results recorded yet.
              </p>
              <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
                When games are finished, record final scores here.
              </p>
            </div>
          ) : (
            <ScheduleGameCentricView
              teamId={teamId}
              teamName={teamName}
              games={resultsGames}
              canEdit={canEdit}
              onRefresh={refreshGames}
              onEditGame={(g) => openEdit(g)}
              recordBeforeMap={recordBeforeFull}
              teamTrends={teamTrendsFull}
              surface="results"
            />
          )}
        </CardContent>
      </Card>

      <TeamGameFormDialog
        teamId={teamId}
        open={formOpen}
        onOpenChange={setFormOpen}
        game={editing}
        onSaved={onSaved}
        suggestedOpponent={
          !editing && scheduleGames.length > 0
            ? scheduleGames[scheduleGames.length - 1]?.opponent?.trim()
            : !editing && orderedGames.length > 0
              ? orderedGames[orderedGames.length - 1]?.opponent?.trim()
              : undefined
        }
      />

      <TeamGamesImportDialog teamId={teamId} open={importOpen} onOpenChange={setImportOpen} onImported={onSaved} />
    </div>
  )
}
