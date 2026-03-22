"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatsLeaderCards } from "@/components/portal/stats-leader-cards"
import { AllStatsTable } from "@/components/portal/all-stats-table"
import { AddWeeklyStatsDialog } from "@/components/portal/add-weekly-stats-dialog"
import { DeleteStatsConfirmDialog } from "@/components/portal/delete-stats-confirm-dialog"
import type { PlayerStatsRow, StatsTableRow, WeeklyStatEntryApi } from "@/lib/stats-helpers"
import { playerToStatsTableRow, weeklyEntryToStatsTableRow } from "@/lib/stats-helpers"
import { Download, FileSpreadsheet, Eye, CheckCircle, FileDown, CalendarPlus, Trash2 } from "lucide-react"
import { rowErrorsToCsv } from "@/lib/stats-import"
import { STATS_IMPORT_HEADERS, STATS_WEEKLY_IMPORT_HEADERS, STAT_IMPORT_FIELDS } from "@/lib/stats-import-fields"
import { trackProductEvent } from "@/lib/utils/analytics-client"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

/** Example data row for format preview only (no real player data). */
const SAMPLE_ROW = ["<player_id>", "First", "Last", "12", "QB", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "5"]

const SAMPLE_WEEKLY_ROW = [
  "<player_id>",
  "First",
  "Last",
  "12",
  "QB",
  "2025",
  "3",
  "",
  "Central",
  "2025-09-01",
  ...Array(STAT_IMPORT_FIELDS.length).fill("0"),
]

type ImportResult = {
  success: boolean
  mode?: "preview" | "import"
  summary?: { processed: number; matched: number; updated: number; skipped: number; errors: number }
  rowErrors?: Array<{ row: number; field?: string; message: string }>
  matchedPlayers?: Array<{ playerId: string; name: string }>
  noChange?: boolean
  noChangeReason?: "blank_stats" | "same_values" | "mixed_no_changes"
  error?: string
}

function getFileKey(file: File | null): string {
  if (!file) return ""
  return `${file.name}:${file.size}:${file.lastModified}`
}

function downloadErrorsCsv(errors: Array<{ row: number; field?: string; message: string }>, label: string) {
  const csv = rowErrorsToCsv(errors)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `import-errors-${label}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function StatsPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => <StatsPageContent teamId={teamId} canEdit={canEdit} />}
    </DashboardPageShell>
  )
}

function StatsPageContent({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const searchParams = useSearchParams()
  const [players, setPlayers] = useState<PlayerStatsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [season, setSeason] = useState(searchParams.get("season") ?? "")
  const [positionFilter, setPositionFilter] = useState(searchParams.get("position") ?? "")
  const [sideFilter, setSideFilter] = useState(searchParams.get("side") ?? "")
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")

  type StatsTab = "all" | "weekly"
  const [statsTab, setStatsTab] = useState<StatsTab>("all")
  const [weekFilter, setWeekFilter] = useState("")
  const [gameFilter, setGameFilter] = useState("")
  const [opponentFilter, setOpponentFilter] = useState("")
  const [dateFilter, setDateFilter] = useState("")

  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyStatEntryApi[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [scheduleGames, setScheduleGames] = useState<
    Array<{ id: string; opponent: string; gameDate: string; seasonYear: number | null }>
  >([])

  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set())
  const [addWeeklyOpen, setAddWeeklyOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewedFileKey, setPreviewedFileKey] = useState<string>("")
  const [importing, setImporting] = useState(false)
  const [importPhase, setImportPhase] = useState<"preview" | "import" | null>(null)
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [lastImportNote, setLastImportNote] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showImportPanel, setShowImportPanel] = useState(false)
  const importPanelRef = useRef<HTMLDivElement | null>(null)
  const [importStatsMode, setImportStatsMode] = useState<"season_totals" | "weekly_entries">("season_totals")
  const [editWeeklyEntry, setEditWeeklyEntry] = useState<WeeklyStatEntryApi | null>(null)

  const canConfirmImport = Boolean(
    selectedFile &&
    !importing &&
    previewResult?.mode === "preview" &&
    getFileKey(selectedFile) === previewedFileKey
  )

  useEffect(() => {
    if (teamId) {
      trackProductEvent(BRAIK_EVENTS.stats.viewed, { teamId })
    }
  }, [teamId])

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
  }, [teamId, refreshTrigger])

  useEffect(() => {
    setSelectedRowKeys(new Set())
  }, [statsTab])

  useEffect(() => {
    if (statsTab !== "weekly" || !teamId) return
    let cancelled = false
    setWeeklyLoading(true)
    setWeeklyError(null)
    const params = new URLSearchParams({ teamId })
    if (season.trim()) params.set("seasonYear", season.trim())
    if (weekFilter.trim()) params.set("week", weekFilter.trim())
    if (gameFilter.trim()) params.set("gameId", gameFilter.trim())
    if (opponentFilter.trim()) params.set("opponent", opponentFilter.trim())
    if (dateFilter.trim()) {
      params.set("dateFrom", dateFilter.trim())
      params.set("dateTo", dateFilter.trim())
    }
    fetch(`/api/stats/weekly?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Access denied" : "Failed to load weekly stats")
        return res.json()
      })
      .then((data: { entries?: WeeklyStatEntryApi[] }) => {
        if (!cancelled && Array.isArray(data?.entries)) setWeeklyEntries(data.entries)
      })
      .catch((err) => {
        if (!cancelled) setWeeklyError(err instanceof Error ? err.message : "Failed to load weekly stats")
      })
      .finally(() => {
        if (!cancelled) setWeeklyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId, statsTab, season, weekFilter, gameFilter, opponentFilter, dateFilter, refreshTrigger])

  useEffect(() => {
    if (statsTab !== "weekly" || !teamId) return
    let cancelled = false
    const q = new URLSearchParams({ teamId })
    if (season.trim()) q.set("seasonYear", season.trim())
    fetch(`/api/stats/games?${q.toString()}`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("games")))
      .then((data: { games?: typeof scheduleGames }) => {
        if (!cancelled && Array.isArray(data?.games)) setScheduleGames(data.games)
      })
      .catch(() => {
        if (!cancelled) setScheduleGames([])
      })
    return () => {
      cancelled = true
    }
  }, [teamId, statsTab, season])

  useEffect(() => {
    if (showImportPanel && importPanelRef.current) {
      importPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [showImportPanel])

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

  const filteredWeeklyTableRows = useMemo((): StatsTableRow[] => {
    let list = weeklyEntries.map(weeklyEntryToStatsTableRow)
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
  }, [weeklyEntries, searchQuery, positionFilter, sideFilter])

  const seasonTableRows = useMemo(() => filteredRows.map(playerToStatsTableRow), [filteredRows])

  const positions = useMemo(() => {
    const set = new Set<string>()
    players.forEach((p) => {
      if (p.position) set.add(p.position)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [players])

  const getProfileHref = (row: StatsTableRow) =>
    `/dashboard/roster/${row.id}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`

  const downloadTemplate = (withRoster: boolean) => {
    const weekly = importStatsMode === "weekly_entries" ? "&weekly=1" : ""
    const url = `/api/stats/template?teamId=${encodeURIComponent(teamId)}${withRoster ? "&withRoster=1" : ""}${weekly}`
    window.open(url, "_blank", "noopener,noreferrer")
    setImportResult(null)
    setPreviewResult(null)
  }

  const runImport = async (preview: boolean) => {
    if (!selectedFile) return
    setImporting(true)
    setImportPhase(preview ? "preview" : "import")
    if (preview) {
      setPreviewResult(null)
      setImportResult(null)
    } else {
      setImportResult(null)
    }
    try {
      const formData = new FormData()
      formData.set("file", selectedFile)
      formData.set("teamId", teamId)
      formData.set("importMode", importStatsMode)
      if (preview) formData.set("preview", "1")
      const res = await fetch("/api/stats/import", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const out: ImportResult = { success: false, error: data?.error ?? "Import failed" }
        if (preview) setPreviewResult(out)
        else setImportResult(out)
        return
      }
      const result: ImportResult = {
        success: data.success,
        mode: data.mode,
        summary: data.summary,
        rowErrors: data.rowErrors,
        matchedPlayers: data.matchedPlayers,
        noChange: data.noChange,
        noChangeReason: data.noChangeReason,
        error: data.error,
      }
      if (preview) {
        setPreviewResult(result)
        if (selectedFile) setPreviewedFileKey(getFileKey(selectedFile))
      } else {
        setImportResult(result)
        if (data.summary?.updated > 0) setRefreshTrigger((t) => t + 1)
        const updated = data.summary?.updated ?? 0
        const errCount = data.summary?.errors ?? data.rowErrors?.length ?? 0
        setLastImportNote(
          importStatsMode === "weekly_entries"
            ? `Last import: ${updated} weekly row(s) created. Season totals were recalculated for affected players. ${errCount} error(s).`
            : `Last import completed just now: ${updated} updated, ${errCount} error(s).`
        )
        setSelectedFile(null)
        setPreviewedFileKey("")
        setPreviewResult(null)
      }
    } catch (e) {
      const out: ImportResult = { success: false, error: e instanceof Error ? e.message : "Import failed" }
      if (preview) setPreviewResult(out)
      else setImportResult(out)
    } finally {
      setImporting(false)
      setImportPhase(null)
    }
  }

  const handlePreview = () => runImport(true)
  const handleConfirmImport = () => runImport(false)

  const handleExportCsv = () => {
    const format = (v: number | null | undefined) =>
      v === null || v === undefined ? "" : String(v)
    const formatStr = (v: string | null | undefined) => (v === null || v === undefined ? "" : String(v))

    if (statsTab === "weekly") {
      const headers = [
        "Week",
        "Game",
        "Opponent",
        "Date",
        "First Name",
        "Last Name",
        "#",
        "Position",
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
      const rows = filteredWeeklyTableRows.map((r) => [
        format(r.weekNumber ?? null),
        formatStr(r.gameLabel),
        formatStr(r.gameOpponent),
        r.gameDate ? String(r.gameDate).slice(0, 10) : "",
        r.firstName,
        r.lastName,
        format(r.jerseyNumber),
        r.position ?? "",
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
        ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
      ].join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `weekly-stats-${teamId}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

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

  const toggleRowSelect = (rowKey: string, selected: boolean) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev)
      if (selected) next.add(rowKey)
      else next.delete(rowKey)
      return next
    })
  }

  const toggleAllVisible = (selected: boolean, visibleRowKeys: string[]) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev)
      for (const k of visibleRowKeys) {
        if (selected) next.add(k)
        else next.delete(k)
      }
      return next
    })
  }

  const executeDeleteSelected = async () => {
    const ids = [...selectedRowKeys]
    if (ids.length === 0) return
    setDeleteError(null)
    setDeleteBusy(true)
    try {
      if (statsTab === "all") {
        const res = await fetch("/api/stats/season", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, playerIds: ids }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(typeof data?.error === "string" ? data.error : "Delete failed")
        }
      } else {
        const res = await fetch("/api/stats/weekly", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, ids }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(typeof data?.error === "string" ? data.error : "Delete failed")
        }
      }
      setSelectedRowKeys(new Set())
      setDeleteConfirmOpen(false)
      setRefreshTrigger((t) => t + 1)
    } catch (e) {
      console.error(e)
      setDeleteError(e instanceof Error ? e.message : "Delete failed.")
    } finally {
      setDeleteBusy(false)
    }
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

  const exportDisabled =
    statsTab === "all" ? filteredRows.length === 0 : filteredWeeklyTableRows.length === 0

  return (
    <div className="mobile-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "rgb(var(--text))" }}>
            Stats
          </h1>
          <p style={{ color: "rgb(var(--muted))" }}>
            {statsTab === "all"
              ? "Season totals from player profiles. Click a row to open the player profile."
              : "Per-game and weekly stat lines. All Stats season totals are the sum of these rows (plus any keys not in weekly sums)."}
          </p>
          <div className="flex flex-wrap gap-2 mt-4" role="tablist" aria-label="Stats view">
            <Button
              type="button"
              size="sm"
              variant={statsTab === "all" ? "default" : "outline"}
              onClick={() => setStatsTab("all")}
              aria-selected={statsTab === "all"}
            >
              All Stats
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statsTab === "weekly" ? "default" : "outline"}
              onClick={() => setStatsTab("weekly")}
              aria-selected={statsTab === "weekly"}
            >
              Weekly / Game Stats
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportPanel((prev) => !prev)}
            >
              {showImportPanel ? "Close Import" : "Import Stats"}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditWeeklyEntry(null)
                setAddWeeklyOpen(true)
              }}
            >
              <CalendarPlus className="h-4 w-4 mr-2" aria-hidden />
              Add Weekly/Game Stats
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exportDisabled}>
            <Download className="h-4 w-4 mr-2" aria-hidden />
            Export CSV
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              disabled={selectedRowKeys.size === 0}
              onClick={() => {
                setDeleteError(null)
                setDeleteConfirmOpen(true)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" aria-hidden />
              Delete Selected
            </Button>
          )}
        </div>
      </div>

      <AddWeeklyStatsDialog
        open={addWeeklyOpen}
        onOpenChange={(o) => {
          setAddWeeklyOpen(o)
          if (!o) setEditWeeklyEntry(null)
        }}
        teamId={teamId}
        roster={players}
        seasonYear={season}
        games={scheduleGames}
        editEntry={editWeeklyEntry}
        onSaved={() => setRefreshTrigger((t) => t + 1)}
      />

      <DeleteStatsConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => {
          setDeleteConfirmOpen(o)
          if (!o) setDeleteError(null)
        }}
        loading={deleteBusy}
        errorMessage={deleteError}
        onConfirm={executeDeleteSelected}
      />

      {/* Filters */}
      <Card className="border mt-6" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
        <CardHeader>
          <CardTitle style={{ color: "rgb(var(--text))" }}>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="stats-season" className="text-foreground">
                Season
              </Label>
              <select
                id="stats-season"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="mobile-select"
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
              <Label htmlFor="stats-position" className="text-foreground">
                Position
              </Label>
              <select
                id="stats-position"
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="mobile-select"
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
              <Label htmlFor="stats-side" className="text-foreground">
                Side of ball
              </Label>
              <select
                id="stats-side"
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
                className="mobile-select"
              >
                <option value="">All</option>
                <option value="offense">Offense</option>
                <option value="defense">Defense</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stats-search" className="text-foreground">
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

          {statsTab === "weekly" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t" style={{ borderColor: "rgb(var(--border))" }}>
              <div className="space-y-2">
                <Label htmlFor="stats-week" className="text-foreground">
                  Week
                </Label>
                <Input
                  id="stats-week"
                  type="number"
                  min={1}
                  max={30}
                  placeholder="Any"
                  value={weekFilter}
                  onChange={(e) => setWeekFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stats-game" className="text-foreground">
                  Game
                </Label>
                <select
                  id="stats-game"
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className="mobile-select"
                >
                  <option value="">All games</option>
                  {scheduleGames.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.opponent ? `vs ${g.opponent}` : "Game"}{" "}
                      {g.gameDate ? `· ${String(g.gameDate).slice(0, 10)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stats-opponent" className="text-foreground">
                  Opponent
                </Label>
                <Input
                  id="stats-opponent"
                  placeholder="Filter by opponent…"
                  value={opponentFilter}
                  onChange={(e) => setOpponentFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stats-date" className="text-foreground">
                  Date
                </Label>
                <Input
                  id="stats-date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && showImportPanel && (
        <div ref={importPanelRef} className="mt-6 space-y-6">
          <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(248,250,252)] p-3 text-sm" style={{ color: "rgb(var(--muted))" }}>
            <p className="font-medium mb-2" style={{ color: "rgb(var(--text))" }}>Import tips</p>
            {importStatsMode === "season_totals" ? (
              <ul className="grid gap-1 sm:grid-cols-2 list-none space-y-0.5 pl-0">
                <li>✓ Best option: download template with roster</li>
                <li>✓ Keep player_id unchanged</li>
                <li>✓ Leave stat cells blank to keep current values</li>
                <li>✓ Enter 0 to set a stat to zero</li>
                <li>✓ One row per player only</li>
                <li>✓ Save as CSV before uploading</li>
              </ul>
            ) : (
              <ul className="grid gap-1 sm:grid-cols-2 list-none space-y-0.5 pl-0">
                <li>✓ Include season_year, week_number, opponent, game_date as needed</li>
                <li>✓ Optional game_id must be a scheduled game for this team</li>
                <li>✓ Multiple rows per player are allowed (one per game/week)</li>
                <li>✓ At least one stat column must be non-blank per row</li>
                <li>✓ After import, season totals are recalculated from weekly rows</li>
                <li>✓ Save as CSV before uploading</li>
              </ul>
            )}
            <p className="mt-2 text-xs">CSV only. Max file size 2MB. Max 2,000 data rows per upload.</p>
          </div>

          <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardHeader>
            <CardTitle style={{ color: "rgb(var(--text))" }}>Bulk import stats</CardTitle>
            <p style={{ color: "rgb(var(--muted))", fontSize: "0.875rem" }}>
              {importStatsMode === "season_totals"
                ? "Download a template, fill in stats offline, then preview and import to merge into each player’s season totals."
                : "Import creates weekly/game stat rows. Season totals on All Stats are recomputed as the sum of weekly rows for each player."}
            </p>
            <div className="space-y-2 mt-3 max-w-md">
              <Label htmlFor="stats-import-mode" style={{ color: "rgb(var(--text))" }}>Import mode</Label>
              <select
                id="stats-import-mode"
                className="mobile-select w-full"
                value={importStatsMode}
                onChange={(e) => {
                  setImportStatsMode(e.target.value as "season_totals" | "weekly_entries")
                  setPreviewedFileKey("")
                  setPreviewResult(null)
                  setImportResult(null)
                  setLastImportNote(null)
                }}
              >
                <option value="season_totals">Season totals</option>
                <option value="weekly_entries">Weekly / game entries</option>
              </select>
            </div>
            <div className="rounded border border-[rgb(var(--border))] bg-[rgb(241,245,249)] p-3 mt-2">
              <p className="text-xs font-medium mb-1" style={{ color: "rgb(var(--muted))" }}>Example format (one row)</p>
              <pre className="text-xs font-mono overflow-x-auto whitespace-pre" style={{ color: "rgb(var(--text))" }}>
                {importStatsMode === "weekly_entries" ? (
                  <>
                    {STATS_WEEKLY_IMPORT_HEADERS.join(",")}
                    {"\n"}
                    {SAMPLE_WEEKLY_ROW.join(",")}
                  </>
                ) : (
                  <>
                    {STATS_IMPORT_HEADERS.join(",")}
                    {"\n"}
                    {SAMPLE_ROW.join(",")}
                  </>
                )}
              </pre>
            </div>
            <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(248,250,252)] p-4 mt-2">
              <p className="font-medium text-sm mb-2" style={{ color: "rgb(var(--text))" }}>How it works</p>
              {importStatsMode === "season_totals" ? (
                <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: "rgb(var(--muted))" }}>
                  <li><strong>Best option:</strong> Use &quot;Download template with roster&quot; — player_id and names are pre-filled so matching is reliable.</li>
                  <li><strong>Matching:</strong> Braik matches by player_id first. If player_id is blank, we match by first name + last name + jersey number (exact).</li>
                  <li><strong>Blank stat cells</strong> leave current values unchanged. Enter <strong>0</strong> if you want to set a stat to zero.</li>
                  <li><strong>Duplicate rows</strong> for the same player in the CSV are rejected; only the first occurrence is applied.</li>
                  <li>Stat values must be <strong>non-negative integers</strong> (no decimals).</li>
                </ul>
              ) : (
                <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: "rgb(var(--muted))" }}>
                  <li>Columns include <strong>season_year</strong>, <strong>week_number</strong>, optional <strong>game_id</strong>, <strong>opponent</strong>, <strong>game_date</strong>, then stat columns.</li>
                  <li>Each row creates one <strong>weekly stat entry</strong>. The same player can appear on multiple rows.</li>
                  <li><strong>game_id</strong> must reference a game on this team, or leave blank and use opponent/date.</li>
                  <li>After a successful import, <strong>season totals</strong> are recalculated from all non-deleted weekly rows.</li>
                  <li>Stat values must be <strong>non-negative integers</strong> (no decimals).</li>
                </ul>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate(false)}
                disabled={importing}
              >
                <Download className="h-4 w-4 mr-2" aria-hidden />
                Download blank template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate(true)}
                disabled={importing}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" aria-hidden />
                Download template with roster
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="stats-csv-file" style={{ color: "rgb(var(--text))" }}>CSV file</Label>
                <Input
                  id="stats-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="max-w-xs"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setSelectedFile(f ?? null)
                    setPreviewedFileKey("")
                    setImportResult(null)
                    setPreviewResult(null)
                    setLastImportNote(null)
                  }}
                  disabled={importing}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={!selectedFile || importing}
              >
                {importPhase === "preview" ? (
                  <>
                    <span className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" aria-hidden />
                    Checking…
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" aria-hidden />
                    Preview import
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                disabled={!canConfirmImport}
                title={!previewResult?.mode ? "Run Preview import first" : getFileKey(selectedFile) !== previewedFileKey ? "Preview applies to a different file" : undefined}
              >
                {importPhase === "import" ? (
                  <>
                    <span className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" aria-hidden />
                    Importing…
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" aria-hidden />
                    Confirm import
                  </>
                )}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                Selected: {selectedFile.name}. Preview applies to this file only.
              </p>
            )}

            {previewResult && previewResult.mode === "preview" && (
              <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(248, 250, 252)" }}>
                <p className="font-medium text-sm" style={{ color: "rgb(var(--text))" }}>Preview</p>
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>Preview generated just now.</p>
                {previewResult.error && <p className="text-sm text-red-700">{previewResult.error}</p>}
                {previewResult.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="rounded border px-3 py-2 bg-white">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>Processed</span>
                      <span className="font-medium">{previewResult.summary.processed}</span>
                    </div>
                    <div className="rounded border px-3 py-2 bg-white">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>Matched</span>
                      <span className="font-medium">{previewResult.summary.matched}</span>
                    </div>
                    <div className="rounded border px-3 py-2 bg-white">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>
                        {importStatsMode === "weekly_entries" ? "Would create" : "Would update"}
                      </span>
                      <span className="font-medium">{previewResult.summary.updated}</span>
                    </div>
                    <div className="rounded border px-3 py-2 bg-white">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>Skipped</span>
                      <span className="font-medium">{previewResult.summary.skipped}</span>
                    </div>
                    <div className="rounded border px-3 py-2 bg-white">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>Errors</span>
                      <span className="font-medium">{previewResult.summary.errors}</span>
                    </div>
                  </div>
                )}
                {previewResult.matchedPlayers && previewResult.matchedPlayers.length > 0 && (
                  <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                    Players that would be updated: {previewResult.matchedPlayers.map((m) => m.name).join(", ")}
                  </p>
                )}
                {previewResult.rowErrors && previewResult.rowErrors.length > 0 && (
                  <>
                    <div className="border rounded p-2 max-h-40 overflow-y-auto">
                      <p className="text-xs font-medium mb-1" style={{ color: "rgb(var(--muted))" }}>Row errors</p>
                      <ul className="text-sm space-y-0.5 list-none">
                        {previewResult.rowErrors.map((err, i) => (
                          <li key={i}>Row {err.row}: {err.message}</li>
                        ))}
                      </ul>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => downloadErrorsCsv(previewResult.rowErrors!, "preview")}>
                      <FileDown className="h-4 w-4 mr-2" aria-hidden />
                      Download errors (CSV)
                    </Button>
                  </>
                )}
              </div>
            )}

            {lastImportNote && (
              <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>{lastImportNote}</p>
            )}

            {importResult && importResult.mode === "import" && (
              <div
                className="rounded-lg border p-4 space-y-3"
                style={{
                  borderColor: importResult.noChange ? "rgb(var(--border))" : importResult.summary?.updated ? "rgb(34, 197, 94)" : importResult.error ? "rgb(239, 68, 68)" : "rgb(var(--border))",
                  backgroundColor: importResult.noChange ? "rgb(248, 250, 252)" : importResult.summary?.updated ? "rgb(240, 253, 244)" : importResult.error ? "rgb(254, 242, 242)" : "rgb(248, 250, 252)",
                }}
              >
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>Import completed just now.</p>
                {importResult.noChange && (
                  <p className="font-medium text-sm" style={{ color: "rgb(var(--text))" }}>
                    {importResult.noChangeReason === "blank_stats" && "No player stats changed. All stat columns were blank."}
                    {importResult.noChangeReason === "same_values" && "No player stats changed. The values in your file matched the current data."}
                    {importResult.noChangeReason === "mixed_no_changes" && "No player stats changed."}
                    {!importResult.noChangeReason && "No player stats changed."}
                  </p>
                )}
                {importResult.error && <p className="font-medium text-red-700">{importResult.error}</p>}
                {importResult.summary && !importResult.noChange && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="rounded border px-3 py-2 bg-white/80">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>Processed</span>
                      <span className="font-medium">{importResult.summary.processed}</span>
                    </div>
                    <div className="rounded border px-3 py-2 bg-white/80">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>Matched</span>
                      <span className="font-medium">{importResult.summary.matched}</span>
                    </div>
                    <div className="rounded border px-3 py-2 bg-white/80">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>
                        {importStatsMode === "weekly_entries" ? "Created" : "Updated"}
                      </span>
                      <span className="font-medium">{importResult.summary.updated}</span>
                    </div>
                    <div className="rounded border px-3 py-2 bg-white/80">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>Skipped</span>
                      <span className="font-medium">{importResult.summary.skipped}</span>
                    </div>
                    <div className="rounded border px-3 py-2 bg-white/80">
                      <span className="text-xs block" style={{ color: "rgb(var(--muted))" }}>Errors</span>
                      <span className="font-medium">{importResult.summary.errors}</span>
                    </div>
                  </div>
                )}
                {importResult.rowErrors && importResult.rowErrors.length > 0 && (
                  <>
                    <div className="border rounded p-2 max-h-40 overflow-y-auto">
                      <p className="text-xs font-medium mb-1" style={{ color: "rgb(var(--muted))" }}>Row errors</p>
                      <ul className="text-sm space-y-0.5 list-none">
                        {importResult.rowErrors.map((err, i) => (
                          <li key={i}>Row {err.row}: {err.message}</li>
                        ))}
                      </ul>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => downloadErrorsCsv(importResult.rowErrors!, "import")}>
                      <FileDown className="h-4 w-4 mr-2" aria-hidden />
                      Download errors (CSV)
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {statsTab === "weekly" && weeklyError && (
        <Card className="border mt-6" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-6" style={{ color: "rgb(var(--muted))" }}>
            {weeklyError}
          </CardContent>
        </Card>
      )}

      {statsTab === "weekly" && weeklyLoading && (
        <div className="flex min-h-[30vh] items-center justify-center mt-6">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent"
            aria-label="Loading weekly stats"
          />
        </div>
      )}

      {statsTab === "all" && filteredRows.length > 0 && (
        <>
          <div className="mt-6">
            <StatsLeaderCards players={filteredRows} />
          </div>
          <div className="mt-6">
            <AllStatsTable
              mode="season"
              rows={seasonTableRows}
              getProfileHref={getProfileHref}
              selectionEnabled={canEdit}
              selectedRowKeys={selectedRowKeys}
              onToggleRow={toggleRowSelect}
              onToggleAllVisible={toggleAllVisible}
            />
          </div>
        </>
      )}

      {statsTab === "weekly" && !weeklyLoading && !weeklyError && filteredWeeklyTableRows.length > 0 && (
        <div className="mt-6">
          <AllStatsTable
            mode="weekly"
            rows={filteredWeeklyTableRows}
            getProfileHref={getProfileHref}
            selectionEnabled={canEdit}
            selectedRowKeys={selectedRowKeys}
            onToggleRow={toggleRowSelect}
            onToggleAllVisible={toggleAllVisible}
            onEditWeeklyRow={
              canEdit
                ? (row) => {
                    const entry = weeklyEntries.find((e) => e.id === row.rowKey)
                    if (entry) {
                      setEditWeeklyEntry(entry)
                      setAddWeeklyOpen(true)
                    }
                  }
                : undefined
            }
          />
        </div>
      )}

      {!loading && !error && statsTab === "all" && players.length === 0 && (
        <Card className="border mt-6" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-12 text-center" style={{ color: "rgb(var(--muted))" }}>
            No players on the roster yet. Add players from the Roster page; their stats will appear here once entered on their profiles.
          </CardContent>
        </Card>
      )}

      {!loading && !error && statsTab === "all" && players.length > 0 && filteredRows.length === 0 && (
        <Card className="border mt-6" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-12 text-center" style={{ color: "rgb(var(--muted))" }}>
            No players match the current filters. Try adjusting season, position, side, or search.
          </CardContent>
        </Card>
      )}

      {!loading &&
        !error &&
        statsTab === "weekly" &&
        !weeklyLoading &&
        !weeklyError &&
        players.length > 0 &&
        weeklyEntries.length === 0 && (
          <Card className="border mt-6" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
            <CardContent className="py-12 text-center" style={{ color: "rgb(var(--muted))" }}>
              No weekly or game stat lines yet. Use Add Weekly/Game Stats to create entries.
            </CardContent>
          </Card>
        )}

      {!loading &&
        !error &&
        statsTab === "weekly" &&
        !weeklyLoading &&
        !weeklyError &&
        weeklyEntries.length > 0 &&
        filteredWeeklyTableRows.length === 0 && (
          <Card className="border mt-6" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
            <CardContent className="py-12 text-center" style={{ color: "rgb(var(--muted))" }}>
              No rows match the current filters. Try adjusting week, game, opponent, date, position, side, or search.
            </CardContent>
          </Card>
        )}

      {!loading && !error && statsTab === "weekly" && players.length === 0 && (
        <Card className="border mt-6" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardContent className="py-12 text-center" style={{ color: "rgb(var(--muted))" }}>
            Add players on the Roster page before entering weekly or game stats.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
