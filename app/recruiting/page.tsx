"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

interface BrowseResult {
  playerId: string
  slug: string | null
  firstName: string
  lastName: string
  positionGroup: string | null
  graduationYear: number | null
  teamName: string | null
  teamLevel: string | null
  programName: string | null
  keyStatSummary: string | null
  recruitingVisibility: boolean
}

export default function PublicRecruitingBrowsePage() {
  const [results, setResults] = useState<BrowseResult[]>([])
  const [loading, setLoading] = useState(false)
  const [metaLoading, setMetaLoading] = useState(true)
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([])
  const [positions, setPositions] = useState<string[]>([])
  const [gradYears, setGradYears] = useState<number[]>([])
  const [filters, setFilters] = useState({
    teamId: "",
    position: "",
    graduationYear: "",
    limit: "20",
  })
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let cancelled = false
    setMetaLoading(true)
    fetch("/api/recruiting/browse-meta")
      .then((res) => (res.ok ? res.json() : { teams: [], positions: [], graduationYears: [] }))
      .then((json) => {
        if (!cancelled) {
          setTeams(json.teams ?? [])
          setPositions(json.positions ?? [])
          setGradYears(json.graduationYears ?? [])
        }
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const runSearch = useCallback(
    async (nextOffset: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filters.position.trim()) params.set("position", filters.position.trim())
        if (filters.graduationYear.trim()) params.set("graduationYear", filters.graduationYear.trim())
        if (filters.teamId.trim()) params.set("teamId", filters.teamId.trim())
        params.set("limit", filters.limit)
        params.set("offset", String(nextOffset))
        const res = await fetch(`/api/recruiting/browse?${params}`)
        if (!res.ok) throw new Error("Browse failed")
        const json = await res.json()
        setResults(json.results ?? [])
        setOffset(nextOffset)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    void runSearch(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial browse only
  }, [])

  const profileHref = (r: BrowseResult) => (r.slug ? `/recruiting/${r.slug}` : `/recruiting/${r.playerId}`)

  return (
    <div className="min-h-screen bg-[#0f1419] text-gray-100">
      <header className="border-b border-gray-800 py-4 px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold text-white hover:text-gray-300">
            Braik
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">Recruiting</span>
            <Link href="/" className="text-blue-400 hover:text-blue-300 hover:underline">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8 px-6 space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Athlete recruiting</h1>
          <p className="mt-2 text-sm text-gray-400 max-w-2xl">
            Browse players from programs on Braik who have made recruiting profiles public. Use filters to narrow
            by team, position, and class year. No account is required.
          </p>
        </div>

        <section className="rounded-xl border border-gray-800 bg-[#161b22] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Team</span>
              <select
                className="rounded-lg border border-gray-700 bg-[#0f1419] px-3 py-2 text-sm text-white"
                value={filters.teamId}
                disabled={metaLoading}
                onChange={(e) => setFilters((f) => ({ ...f, teamId: e.target.value }))}
              >
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Position</span>
              <select
                className="rounded-lg border border-gray-700 bg-[#0f1419] px-3 py-2 text-sm text-white"
                value={filters.position}
                disabled={metaLoading}
                onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value }))}
              >
                <option value="">All positions</option>
                {positions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Graduation year</span>
              <select
                className="rounded-lg border border-gray-700 bg-[#0f1419] px-3 py-2 text-sm text-white"
                value={filters.graduationYear}
                disabled={metaLoading}
                onChange={(e) => setFilters((f) => ({ ...f, graduationYear: e.target.value }))}
              >
                <option value="">All years</option>
                {gradYears.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Per page</span>
              <select
                className="rounded-lg border border-gray-700 bg-[#0f1419] px-3 py-2 text-sm text-white"
                value={filters.limit}
                onChange={(e) => setFilters((f) => ({ ...f, limit: e.target.value }))}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => runSearch(0)}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-[#161b22] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-white">Players</h2>
          <p className="mt-1 text-sm text-gray-500">
            {metaLoading
              ? "Loading filter options…"
              : "Only players with public film, video links, a bio, or listed measurables are listed. Use Next/Previous to page through results."}
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading…</p>
          ) : results.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              No athletes match these filters yet, or coaches have not published recruiting profiles for this program.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {results.map((r) => (
                <li
                  key={r.playerId}
                  className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-[#0f1419] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link href={profileHref(r)} className="text-lg font-medium text-blue-400 hover:text-blue-300 hover:underline">
                      {r.firstName} {r.lastName}
                    </Link>
                    <p className="text-sm text-gray-400">
                      {[r.positionGroup, r.graduationYear != null ? `Class of ${r.graduationYear}` : null, r.teamName, r.teamLevel]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {r.programName && <p className="text-xs text-gray-500">{r.programName}</p>}
                    {r.keyStatSummary && <p className="mt-1 text-xs text-gray-500">{r.keyStatSummary}</p>}
                  </div>
                  <Link
                    href={profileHref(r)}
                    className="inline-flex shrink-0 justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    View profile
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!loading && results.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => runSearch(Math.max(0, offset - parseInt(filters.limit, 10)))}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={results.length < parseInt(filters.limit, 10) || loading}
                onClick={() => runSearch(offset + parseInt(filters.limit, 10))}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40"
              >
                Next
              </button>
              <span className="text-xs text-gray-500">
                Offset {offset} · up to {filters.limit} per page
              </span>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
