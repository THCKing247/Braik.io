"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type TeamGameRow,
  inferScheduleStatus,
  inferHomeAway,
  sortGamesScheduleView,
} from "@/lib/team-schedule-games"
import { ListOrdered, MapPin } from "lucide-react"

export default function TeamSchedulePage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => <TeamScheduleContent teamId={teamId} />}
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

function TeamScheduleContent({ teamId }: { teamId: string }) {
  const [games, setGames] = useState<TeamGameRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/stats/games?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { games?: TeamGameRow[] } | null) => {
        if (!cancelled && data?.games && Array.isArray(data.games)) {
          setGames(data.games)
        } else if (!cancelled) {
          setGames([])
        }
      })
      .catch(() => {
        if (!cancelled) setGames([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const sorted = sortGamesScheduleView(games)

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-0 pb-8 pt-2 md:px-0 md:pt-0">
      <div className="px-4 md:px-0">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl" style={{ color: "rgb(var(--text))" }}>
          Schedule
        </h1>
        <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
          Team games only. Manage practices and other events in Calendar.
        </p>
      </div>

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
                No games on the schedule yet
              </p>
              <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
                Games are managed from team settings and season tools. Calendar events are separate from this list.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
                    <th className="px-4 py-3 font-semibold md:px-0" style={{ color: "rgb(var(--muted))" }}>
                      Date
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Time
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Opponent
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Home / Away
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Location
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: "rgb(var(--muted))" }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((g) => {
                    const d = new Date(g.gameDate)
                    const status = inferScheduleStatus(g)
                    const ha = inferHomeAway(g.location)
                    const homeAway =
                      ha === "home" ? "Home" : ha === "away" ? "Away" : "—"
                    return (
                      <tr
                        key={g.id}
                        className="border-b last:border-0"
                        style={{ borderColor: "rgb(var(--border))" }}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium md:px-0" style={{ color: "rgb(var(--text))" }}>
                          {Number.isFinite(d.getTime()) ? format(d, "EEE, MMM d, yyyy") : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3" style={{ color: "rgb(var(--text2))" }}>
                          {Number.isFinite(d.getTime()) ? format(d, "h:mm a") : "—"}
                        </td>
                        <td className="max-w-[200px] px-4 py-3 font-medium" style={{ color: "rgb(var(--text))" }}>
                          {g.opponent?.trim() || "TBD"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3" style={{ color: "rgb(var(--text2))" }}>
                          {homeAway}
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <span className="inline-flex items-start gap-1.5" style={{ color: "rgb(var(--text2))" }}>
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                            <span className="line-clamp-2">{g.location?.trim() || "—"}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3" style={{ color: "rgb(var(--text2))" }}>
                          {statusLabel(status)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
