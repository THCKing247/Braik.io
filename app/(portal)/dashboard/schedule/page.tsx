"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { DashboardScheduleSkeleton } from "@/components/portal/dashboard-route-skeletons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { type TeamGameRow, parseGameDateMs } from "@/lib/team-schedule-games"
import { ListOrdered, Plus, Upload, Download } from "lucide-react"
import { emitTeamGamesChanged } from "@/lib/team-games-events"

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

function downloadScheduleCsv(games: TeamGameRow[]) {
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
  a.download = `game-schedule-${format(new Date(), "yyyy-MM-dd")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function TeamScheduleContent({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const router = useRouter()
  const [games, setGames] = useState<TeamGameRow[]>([])
  const [teamName, setTeamName] = useState<string>("Your team")
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<TeamGameRow | null>(null)

  const loadGames = useCallback(() => {
    setLoading(true)
    fetch(`/api/stats/games?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { games?: TeamGameRow[] } | null) => {
        if (data?.games && Array.isArray(data.games)) {
          setGames(data.games)
        } else {
          setGames([])
        }
      })
      .catch(() => setGames([]))
      .finally(() => setLoading(false))
  }, [teamId])

  useEffect(() => {
    let cancelled = false
    // Defer team display name — games list is the critical path for first paint
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

  useEffect(() => {
    loadGames()
  }, [loadGames])

  const onSaved = useCallback(() => {
    loadGames()
    router.refresh()
    emitTeamGamesChanged(teamId)
  }, [loadGames, router, teamId])

  const orderedGames = useMemo(
    () => [...games].sort((a, b) => parseGameDateMs(a.gameDate) - parseGameDateMs(b.gameDate)),
    [games]
  )

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (g: TeamGameRow) => {
    setEditing(g)
    setFormOpen(true)
  }

  if (loading) {
    return <DashboardScheduleSkeleton />
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
            Manage your team&apos;s games here — add games, import a CSV, or edit results.
          </p>
        )}
      </div>

      {canEdit && (
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
            disabled={orderedGames.length === 0}
            onClick={() => downloadScheduleCsv(orderedGames)}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        </div>
      )}

      <Card
        className="overflow-hidden border-0 shadow-sm ring-1 ring-black/[0.05] md:border md:ring-0"
        style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
      >
        <CardHeader className="flex flex-row items-center gap-2 px-4 pb-2 pt-4 md:px-6">
          <ListOrdered className="h-5 w-5 shrink-0" style={{ color: "rgb(var(--accent))" }} aria-hidden />
          <CardTitle className="text-base font-semibold md:text-lg" style={{ color: "rgb(var(--text))" }}>
            Game schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-4 md:px-6 md:pb-6">
          {orderedGames.length === 0 ? (
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
          ) : (
            <ScheduleGameCentricView
              teamId={teamId}
              teamName={teamName}
              games={orderedGames}
              canEdit={canEdit}
              onRefresh={loadGames}
              onEditGame={(g) => openEdit(g)}
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
          !editing && orderedGames.length > 0
            ? orderedGames[orderedGames.length - 1]?.opponent?.trim()
            : undefined
        }
      />

      <TeamGamesImportDialog teamId={teamId} open={importOpen} onOpenChange={setImportOpen} onImported={onSaved} />
    </div>
  )
}
