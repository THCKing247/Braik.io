"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { LoadingState } from "@/components/ui/loading-state"

interface Program {
  id: string
  programName: string
}

interface Overview {
  programId: string
  programName: string
  rosterByLevel: { teamLevel: string; teamName: string; count: number }[]
  totalRoster: number
  totalCoaches: number
  averagePlaybookMasteryPct: number | null
  playersWithRecentDevelopmentLogs: number
  recruitingVisibleCount: number
  playersWithRecruiterInterest: number
}

interface DashboardData {
  overview?: Overview
  breakout?: {
    candidates: {
      playerId: string
      playerName: string
      teamLevel: string | null
      positionGroup: string | null
      score: number
      explanation: string
      dashboardPlayerPath: string | null
    }[]
  }
  promotions?: {
    candidates: {
      playerId: string
      playerName: string
      currentLevel: string
      positionGroup: string | null
      score: number
      explanation: string
      dashboardPlayerPath: string | null
    }[]
  }
  playbookReadiness?: {
    offenseReadinessPct: number | null
    defenseReadinessPct: number | null
    lowestReadinessPositionGroups: { positionGroup: string; avgPct: number; playerCount: number }[]
    playersBehindOnAssignments: {
      playerId: string
      playerName: string
      completed: number
      total: number
      pct: number
      dashboardPlayerPath: string | null
    }[]
  }
  recruitingReady?: {
    players: {
      playerId: string
      playerName: string
      teamLevel: string | null
      positionGroup: string | null
      hasVisibility: boolean
      explanation: string
      dashboardPlayerPath: string | null
    }[]
  }
  risks?: { risks: { type: string; severity: string; title: string; explanation: string; linkToTeamId?: string }[] }
}

export default function ProgramIntelligencePage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [programId, setProgramId] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const currentRes = await fetch("/api/programs/current")
        const currentJson = await currentRes.json()
        if (currentJson.program?.id) {
          if (!cancelled) {
            setProgramId(currentJson.program.id)
          }
        }
        if (!currentJson.program?.id) {
          const listRes = await fetch("/api/programs/list")
          const listJson = await listRes.json()
          const progs = listJson.programs ?? []
          if (!cancelled && progs.length > 0) {
            setPrograms(progs)
            setProgramId(progs[0].id)
          }
        }
      } catch (e) {
        if (!cancelled) setError("Failed to load programs")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!programId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/program-intelligence/dashboard?programId=${encodeURIComponent(programId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load dashboard")
        return res.json()
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load intelligence data")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [programId])

  return (
    <DashboardPageShell requireTeam={false}>
      {() => (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#212529]">Program Intelligence</h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Roster health, breakout candidates, playbook readiness, recruiting pipeline, and risks.
              </p>
            </div>
            {programs.length > 1 && (
              <select
                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827]"
                value={programId ?? ""}
                onChange={(e) => setProgramId(e.target.value)}
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.programName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading && !data && (
            <LoadingState label="Loading program intelligence" minHeightClassName="min-h-[200px]" size="lg" />
          )}

          {!loading && data && (
            <>
              {/* Program Snapshot */}
              {data.overview && (
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#111827]">Program Snapshot</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">{data.overview.programName}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs font-medium text-[#6B7280]">Total Roster</p>
                      <p className="text-xl font-semibold text-[#111827]">{data.overview.totalRoster}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#6B7280]">Coaches</p>
                      <p className="text-xl font-semibold text-[#111827]">{data.overview.totalCoaches}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#6B7280]">Avg playbook mastery</p>
                      <p className="text-xl font-semibold text-[#111827]">
                        {data.overview.averagePlaybookMasteryPct != null ? `${data.overview.averagePlaybookMasteryPct}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#6B7280]">Recruiting visible</p>
                      <p className="text-xl font-semibold text-[#111827]">{data.overview.recruitingVisibleCount}</p>
                    </div>
                  </div>
                  {data.overview.rosterByLevel?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-[#6B7280]">Roster by level</p>
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {data.overview.rosterByLevel.map((l) => (
                          <li key={l.teamLevel} className="rounded bg-[#F3F4F6] px-2 py-1 text-sm">
                            {l.teamName}: {l.count}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* Breakout Players */}
              {(data.breakout?.candidates?.length ?? 0) > 0 && (
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#111827]">Breakout Players</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">Top players by development, evaluations, and playbook mastery.</p>
                  <ul className="mt-4 space-y-2">
                    {(data.breakout?.candidates ?? []).map((c) => (
                      <li key={c.playerId} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-3">
                        <div>
                          <Link
                            href={c.dashboardPlayerPath ?? `/dashboard/roster/${c.playerId}`}
                            className="font-medium text-[#2563EB] hover:underline"
                          >
                            {c.playerName}
                          </Link>
                          <p className="text-xs text-[#6B7280]">
                            {[c.positionGroup, c.teamLevel].filter(Boolean).join(" · ")} — {c.explanation}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-[#6B7280]">Score {c.score}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Promotion Watchlist */}
              {(data.promotions?.candidates?.length ?? 0) > 0 && (
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#111827]">Promotion Watchlist</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">JV/Freshman candidates to move up.</p>
                  <ul className="mt-4 space-y-2">
                    {(data.promotions?.candidates ?? []).map((c) => (
                      <li key={c.playerId} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-3">
                        <div>
                          <Link
                            href={c.dashboardPlayerPath ?? `/dashboard/roster/${c.playerId}`}
                            className="font-medium text-[#2563EB] hover:underline"
                          >
                            {c.playerName}
                          </Link>
                          <p className="text-xs text-[#6B7280]">{c.currentLevel} · {c.explanation}</p>
                        </div>
                        <span className="text-sm font-medium text-[#6B7280]">Score {c.score}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Playbook Readiness */}
              {data.playbookReadiness && (
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#111827]">Playbook Readiness</h2>
                  <div className="mt-4 flex flex-wrap gap-4">
                    {data.playbookReadiness.offenseReadinessPct != null && (
                      <div>
                        <p className="text-xs text-[#6B7280]">Offense</p>
                        <p className="text-xl font-semibold">{data.playbookReadiness.offenseReadinessPct}%</p>
                      </div>
                    )}
                    {data.playbookReadiness.defenseReadinessPct != null && (
                      <div>
                        <p className="text-xs text-[#6B7280]">Defense</p>
                        <p className="text-xl font-semibold">{data.playbookReadiness.defenseReadinessPct}%</p>
                      </div>
                    )}
                  </div>
                  {data.playbookReadiness.lowestReadinessPositionGroups?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-[#6B7280]">Lowest completion by position</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {data.playbookReadiness.lowestReadinessPositionGroups.map((g) => (
                          <li key={g.positionGroup}>{g.positionGroup}: {g.avgPct}% ({g.playerCount} players)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.playbookReadiness.playersBehindOnAssignments?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-[#6B7280]">Players behind on assignments</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {data.playbookReadiness.playersBehindOnAssignments.slice(0, 5).map((p) => (
                          <li key={p.playerId}>
                            <Link
                              href={p.dashboardPlayerPath ?? `/dashboard/roster/${p.playerId}`}
                              className="text-[#2563EB] hover:underline"
                            >
                              {p.playerName}
                            </Link>
                            {" "}({p.pct}%)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* Recruiting Pipeline */}
              {(data.recruitingReady?.players?.length ?? 0) > 0 && (
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#111827]">Recruiting Pipeline</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">Players ready for recruiting exposure.</p>
                  <ul className="mt-4 space-y-2">
                    {(data.recruitingReady?.players ?? []).map((p) => (
                      <li key={p.playerId} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-3">
                        <div>
                          <Link
                            href={p.dashboardPlayerPath ?? `/dashboard/roster/${p.playerId}`}
                            className="font-medium text-[#2563EB] hover:underline"
                          >
                            {p.playerName}
                          </Link>
                          <p className="text-xs text-[#6B7280]">{[p.positionGroup, p.teamLevel].filter(Boolean).join(" · ")} — {p.explanation}</p>
                        </div>
                        {p.hasVisibility && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Visible</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Risks */}
              {(data.risks?.risks?.length ?? 0) > 0 && (
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#111827]">Risks &amp; Attention Needed</h2>
                  <ul className="mt-4 space-y-2">
                    {(data.risks?.risks ?? []).map((r, i) => (
                      <li
                        key={i}
                        className={`rounded-lg border p-3 ${
                          r.severity === "high" ? "border-red-200 bg-red-50" : r.severity === "medium" ? "border-amber-200 bg-amber-50" : "border-[#E5E7EB] bg-[#F9FAFB]"
                        }`}
                      >
                        <p className="font-medium text-[#111827]">{r.title}</p>
                        <p className="mt-1 text-sm text-[#6B7280]">{r.explanation}</p>
                        {r.linkToTeamId && (
                          <Link href={`/dashboard?teamId=${r.linkToTeamId}`} className="mt-2 inline-block text-sm text-[#2563EB] hover:underline">
                            View team →
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!data.overview && !data.breakout?.candidates?.length && !data.promotions?.candidates?.length && !data.recruitingReady?.players?.length && !data.risks?.risks?.length && (
                <p className="text-sm text-[#6B7280]">No intelligence data yet. Add roster, evaluations, and playbook assignments to see insights.</p>
              )}
            </>
          )}
        </div>
      )}
    </DashboardPageShell>
  )
}
