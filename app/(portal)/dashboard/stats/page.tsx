"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatsLeaderCards } from "@/components/portal/stats-leader-cards"
import { AllStatsTable } from "@/components/portal/all-stats-table"
import type { PlayerStatsRow } from "@/lib/stats-helpers"
import { Download } from "lucide-react"

export default function StatsPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => <StatsPageContent teamId={teamId} />}
    </DashboardPageShell>
  )
}

function StatsPageContent({ teamId }: { teamId: string }) {
  const searchParams = useSearchParams()
  const [players, setPlayers] = useState<PlayerStatsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [season, setSeason] = useState(searchParams.get("season") ?? "")
  const [positionFilter, setPositionFilter] = useState(searchParams.get("position") ?? "")
  const [sideFilter, setSideFilter] = useState(searchParams.get("side") ?? "")
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/stats?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Access denied" : "Failed to load stats")
        return res.json()
      })
      .then((data: { players?: PlayerStatsRow[] }) => {
        if (!cancelled && Array.isArray(data?.players)) {
          setPlayers(data.players)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stats")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [teamId])

  const filteredRows = useMemo(() => {
    let list = players
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          (p.firstName?.toLowerCase() ?? "").includes(q) ||
          (p.lastName?.toLowerCase() ?? "").includes(q) ||
          String(p.jerseyNumber ?? "").includes(q)
      )
    }
    if (positionFilter) {
      list = list.filter((p) => (p.position ?? "").toUpperCase() === positionFilter.toUpperCase())
    }
    if (sideFilter) {
      list = list.filter((p) => p.sideOfBall === sideFilter)
    }
    return list
  }, [players, searchQuery, positionFilter, sideFilter])

  const positions = useMemo(() => {
    const set = new Set<string>()
    players.forEach((p) => {
      if (p.position) set.add(p.position)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [players])

  const getProfileHref = (row: PlayerStatsRow) =>
    `/dashboard/roster/${row.id}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`

  const handleExportCsv = () => {
    const headers = [
      "First Name",
      "Last Name",
      "#",
      "Position",
      "Side",
      "GP",
      "Pass Yds",
      "Pass TD",
      "INT Thrown",
      "Rush Yds",
      "Rush TD",
      "Rec",
      "Rec Yds",
      "Rec TD",
      "Tackles",
      "Sacks",
      "INT",
    ]
    const format = (v: number | null | undefined) =>
      v === null || v === undefined ? "" : String(v)
    const rows = filteredRows.map((r) => [
      r.firstName,
      r.lastName,
      format(r.jerseyNumber),
      r.position ?? "",
      r.sideOfBall ?? "",
      format(r.gamesPlayed),
      format(r.passingYards),
      format(r.passingTds),
      format(r.intThrown),
      format(r.rushingYards),
      format(r.rushingTds),
      format(r.receptions),
      format(r.receivingYards),
      format(r.receivingTds),
      format(r.tackles),
      format(r.sacks),
      format(r.interceptions),
    ])
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `all-stats-${teamId}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "rgb(var(--text))" }}>
            All Stats
          </h1>
          <p style={{ color: "rgb(var(--muted))" }}>
            Team statistics aggregated from player profiles
          </p>
        </div>
        <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardHeader>
            <CardTitle style={{ color: "rgb(var(--text))" }}>Unable to load stats</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ color: "rgb(var(--muted))" }}>{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "rgb(var(--text))" }}>
            All Stats
          </h1>
          <p style={{ color: "rgb(var(--muted))" }}>
            Team statistics aggregated from player profiles. Click a row to open the player profile.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filteredRows.length === 0}>
          <Download className="h-4 w-4 mr-2" aria-hidden />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
        <CardHeader>
          <CardTitle style={{ color: "rgb(var(--text))" }}>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="stats-season" style={{ color: "rgb(var(--text))" }}>
                Season
              </Label>
              <select
                id="stats-season"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="flex h-11 w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm text-[#0F172A] border-[#0B2A5B] focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
              >
                <option value="">All / Current</option>
                {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-position" style={{ color: "rgb(var(--text))" }}>
                Position
              </Label>
              <select
                id="stats-position"
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="flex h-11 w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm text-[#0F172A] border-[#0B2A5B] focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
              >
                <option value="">All positions</option>
                {positions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-side" style={{ color: "rgb(var(--text))" }}>
                Side of ball
              </Label>
              <select
                id="stats-side"
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
                className="flex h-11 w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm text-[#0F172A] border-[#0B2A5B] focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
              >
                <option value="">All</option>
                <option value="offense">Offense</option>
                <option value="defense">Defense</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-search" style={{ color: "rgb(var(--text))" }}>
                Search (name or number)
              </Label>
              <Input
                id="stats-search"
                type="search"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredRows.length > 0 && (
        <>
          <StatsLeaderCards players={filteredRows} />
          <AllStatsTable rows={filteredRows} getProfileHref={getProfileHref} />
        </>
      )}

      {!loading && !error && players.length === 0 && (
        <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-12 text-center" style={{ color: "rgb(var(--muted))" }}>
            No players on the roster yet. Add players from the Roster page; their stats will appear here once entered on their profiles.
          </CardContent>
        </Card>
      )}

      {!loading && !error && players.length > 0 && filteredRows.length === 0 && (
        <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-12 text-center" style={{ color: "rgb(var(--muted))" }}>
            No players match the current filters. Try adjusting season, position, side, or search.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
