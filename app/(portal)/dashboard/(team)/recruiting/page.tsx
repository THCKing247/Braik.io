"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

interface SearchResult {
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

interface SavedPlayer {
  playerId: string
  savedAt: string
  slug: string | null
  firstName: string
  lastName: string
  positionGroup: string | null
  recruitingVisibility: boolean
}

export default function RecruiterPortalPage() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [saved, setSaved] = useState<SavedPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [savedLoading, setSavedLoading] = useState(true)
  const [filters, setFilters] = useState({ position: "", graduationYear: "", limit: "20" })
  const [searchRan, setSearchRan] = useState(false)

  const runSearch = async () => {
    setLoading(true)
    setSearchRan(true)
    try {
      const params = new URLSearchParams()
      if (filters.position.trim()) params.set("position", filters.position.trim())
      if (filters.graduationYear.trim()) params.set("graduationYear", filters.graduationYear.trim())
      params.set("limit", filters.limit)
      const res = await fetch(`/api/recruiting/search?${params}`)
      if (!res.ok) throw new Error("Search failed")
      const json = await res.json()
      setResults(json.results ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setSavedLoading(true)
    fetch("/api/recruiting/saved-players")
      .then((res) => res.ok ? res.json() : { saved: [] })
      .then((json) => {
        if (!cancelled) setSaved(json.saved ?? [])
      })
      .finally(() => {
        if (!cancelled) setSavedLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const savePlayer = async (playerId: string) => {
    const res = await fetch("/api/recruiting/save-player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    })
    if (res.ok) {
      const already = saved.some((s) => s.playerId === playerId)
      if (!already) {
        const r = results.find((x) => x.playerId === playerId)
        if (r)
          setSaved((prev) => [
            ...prev,
            {
              playerId: r.playerId,
              savedAt: new Date().toISOString(),
              slug: r.slug,
              firstName: r.firstName,
              lastName: r.lastName,
              positionGroup: r.positionGroup,
              recruitingVisibility: r.recruitingVisibility,
            },
          ])
      }
    }
  }

  const profileLink = (r: SearchResult) => (r.slug ? `/recruiting/${r.slug}` : `/recruiting/${r.playerId}`)

  return (
    <DashboardPageShell requireTeam={false}>
      {() => (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-[#212529]">Recruiter Portal</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Search recruiting-visible players and manage your saved list.
            </p>
          </div>

          {/* Saved players */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Saved Players</h2>
            {savedLoading ? (
              <p className="mt-2 text-sm text-[#6B7280]">Loading…</p>
            ) : saved.length === 0 ? (
              <p className="mt-2 text-sm text-[#6B7280]">No saved players. Search and click Save to add.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {saved.map((s) => (
                  <li key={s.playerId} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-3">
                    <div>
                      <Link
                        href={s.slug ? `/recruiting/${s.slug}` : `/recruiting/${s.playerId}`}
                        className="font-medium text-[#2563EB] hover:underline"
                      >
                        {s.firstName} {s.lastName}
                      </Link>
                      <p className="text-xs text-[#6B7280]">{s.positionGroup ?? "—"}</p>
                    </div>
                    <span className="text-xs text-[#6B7280]">Saved</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Search */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827]">Search Players</h2>
            <div className="mt-4 flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Position (e.g. QB)"
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={filters.position}
                onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Graduation year"
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={filters.graduationYear}
                onChange={(e) => setFilters((f) => ({ ...f, graduationYear: e.target.value }))}
              />
              <select
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={filters.limit}
                onChange={(e) => setFilters((f) => ({ ...f, limit: e.target.value }))}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <button
                type="button"
                onClick={runSearch}
                disabled={loading}
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>

            {searchRan && (
              <div className="mt-4">
                <p className="text-sm text-[#6B7280]">{total} recruiting-visible players found.</p>
                {loading ? (
                  <p className="mt-2 text-sm text-[#6B7280]">Loading…</p>
                ) : results.length === 0 ? (
                  <p className="mt-2 text-sm text-[#6B7280]">No results. Try different filters or ask coaches to enable recruiting visibility.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {results.map((r) => (
                      <li key={r.playerId} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-3">
                        <div>
                          <Link href={profileLink(r)} className="font-medium text-[#2563EB] hover:underline">
                            {r.firstName} {r.lastName}
                          </Link>
                          <p className="text-xs text-[#6B7280]">
                            {[r.positionGroup, r.graduationYear != null ? `Class of ${r.graduationYear}` : null, r.teamName, r.teamLevel].filter(Boolean).join(" · ")}
                          </p>
                          {r.keyStatSummary && <p className="text-xs text-[#6B7280]">{r.keyStatSummary}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => savePlayer(r.playerId)}
                            className="rounded bg-[#E5E7EB] px-2 py-1 text-xs font-medium text-[#374151] hover:bg-[#D1D5DB]"
                          >
                            Save
                          </button>
                          <Link
                            href={profileLink(r)}
                            className="rounded bg-[#2563EB] px-2 py-1 text-xs font-medium text-white hover:bg-[#1D4ED8]"
                          >
                            Profile
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardPageShell>
  )
}
