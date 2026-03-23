"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  type TeamGameRow,
  inferScheduleStatus,
  inferHomeAway,
  sortGamesScheduleView,
} from "@/lib/team-schedule-games"
import { ListOrdered, MapPin, Plus, Upload, Download, Pencil } from "lucide-react"
import { TeamGameFormDialog } from "@/components/portal/team-game-form-dialog"
import { TeamGamesImportDialog } from "@/components/portal/team-games-import-dialog"
import { emitTeamGamesChanged } from "@/lib/team-games-events"

export default function TeamSchedulePage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => <TeamScheduleContent teamId={teamId} canEdit={canEdit} />}
    </DashboardPageShell>
  )
}

function statusLabel(status: ReturnType<typeof inferScheduleStatus>): string {
  switch (status) {
    case "completed":
      return "Final"
    case "postponed":
      return "Postponed"
    case "cancelled":
      return "Cancelled"
    default:
      return "Scheduled"
  }
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
    loadGames()
  }, [loadGames])

  const onSaved = useCallback(() => {
    loadGames()
    router.refresh()
    emitTeamGamesChanged(teamId)
  }, [loadGames, router, teamId])

  const sorted = sortGamesScheduleView(games)

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (g: TeamGameRow) => {
    setEditing(g)
    setFormOpen(true)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
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
            disabled={sorted.length === 0}
            onClick={() => downloadScheduleCsv(sorted)}
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
          {sorted.length === 0 ? (
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
                    <th className="px-3 py-3 font-semibold md:pl-0" style={{ color: "rgb(var(--muted))" }}>
                      Date
                    </th>
                    <th className="px-3 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Time
                    </th>
                    <th className="px-3 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Opponent
                    </th>
                    <th className="px-3 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      H/A
                    </th>
                    <th className="px-3 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Location
                    </th>
                    <th className="px-3 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Status
                    </th>
                    {canEdit && (
                      <th className="px-3 py-3 text-right font-semibold" style={{ color: "rgb(var(--muted))" }}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((g) => {
                    const d = new Date(g.gameDate)
                    const status = inferScheduleStatus(g)
                    const ha = inferHomeAway(g.location)
                    const homeAway = ha === "home" ? "Home" : ha === "away" ? "Away" : "—"
                    return (
                      <tr
                        key={g.id}
                        className="border-b last:border-0"
                        style={{ borderColor: "rgb(var(--border))" }}
                      >
                        <td className="whitespace-nowrap px-3 py-3 font-medium md:pl-0" style={{ color: "rgb(var(--text))" }}>
                          {Number.isFinite(d.getTime()) ? format(d, "EEE, MMM d, yyyy") : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3" style={{ color: "rgb(var(--text2))" }}>
                          {Number.isFinite(d.getTime()) ? format(d, "h:mm a") : "—"}
                        </td>
                        <td className="max-w-[200px] px-3 py-3 font-medium" style={{ color: "rgb(var(--text))" }}>
                          {g.opponent?.trim() || "TBD"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3" style={{ color: "rgb(var(--text2))" }}>
                          {homeAway}
                        </td>
                        <td className="max-w-[220px] px-3 py-3">
                          <span className="inline-flex items-start gap-1.5" style={{ color: "rgb(var(--text2))" }}>
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                            <span className="line-clamp-2">{g.location?.trim() || "—"}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3" style={{ color: "rgb(var(--text2))" }}>
                          {statusLabel(status)}
                        </td>
                        {canEdit && (
                          <td className="whitespace-nowrap px-3 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 gap-1"
                              onClick={() => openEdit(g)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              Edit
                            </Button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <TeamGameFormDialog
        teamId={teamId}
        open={formOpen}
        onOpenChange={setFormOpen}
        game={editing}
        onSaved={onSaved}
      />

      <TeamGamesImportDialog teamId={teamId} open={importOpen} onOpenChange={setImportOpen} onImported={onSaved} />
    </div>
  )
}
