"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { DashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"

/** Coalesce concurrent summaryOnly fetches (duplicate mounts, Strict Mode, fast remounts). */
const readinessSummaryInFlight = new Map<
  string,
  Promise<
    | { forbidden: true }
    | {
        summary: { total: number; incompleteCount: number; readyCount: number } | null
      }
  >
>()

function fetchReadinessSummaryOnce(teamId: string) {
  const existing = readinessSummaryInFlight.get(teamId)
  if (existing) return existing
  const p = (async () => {
    const res = await fetch(`/api/teams/${teamId}/readiness?summaryOnly=1`)
    if (res.status === 403) return { forbidden: true as const }
    if (!res.ok) {
      return { summary: null as { total: number; incompleteCount: number; readyCount: number } | null }
    }
    const data = (await res.json()) as {
      summary?: { total?: number; incompleteCount?: number; readyCount?: number }
    }
    if (data?.summary) {
      return {
        summary: {
          total: data.summary.total ?? 0,
          incompleteCount: data.summary.incompleteCount ?? 0,
          readyCount: data.summary.readyCount ?? 0,
        },
      }
    }
    return { summary: null }
  })().finally(() => readinessSummaryInFlight.delete(teamId))
  readinessSummaryInFlight.set(teamId, p)
  return p
}

export default function ReadinessSummaryCard({
  teamId,
  dashboardBootstrapState,
  readinessFromBootstrap,
}: {
  teamId: string
  dashboardBootstrapState: "loading" | "ok" | "fallback"
  readinessFromBootstrap?: DashboardBootstrapPayload["readiness"]
}) {
  const readinessHref = `/dashboard/roster?teamId=${encodeURIComponent(teamId)}&tab=readiness`
  const okSkipped =
    dashboardBootstrapState === "ok" &&
    readinessFromBootstrap &&
    "skipped" in readinessFromBootstrap
  const okSummary =
    dashboardBootstrapState === "ok" &&
    readinessFromBootstrap &&
    "summary" in readinessFromBootstrap
      ? readinessFromBootstrap.summary
      : null

  const [summary, setSummary] = useState<{ total: number; incompleteCount: number; readyCount: number } | null>(null)
  const [loading, setLoading] = useState(() => {
    if (dashboardBootstrapState === "loading") return true
    if (okSummary) return false
    return dashboardBootstrapState === "fallback"
  })
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    setSummary(null)
    setForbidden(false)
  }, [teamId])

  useEffect(() => {
    if (dashboardBootstrapState === "loading") {
      setLoading(true)
      return
    }
    const skipped =
      dashboardBootstrapState === "ok" &&
      readinessFromBootstrap &&
      "skipped" in readinessFromBootstrap
    const inlineSummary =
      dashboardBootstrapState === "ok" &&
      readinessFromBootstrap &&
      "summary" in readinessFromBootstrap
        ? readinessFromBootstrap.summary
        : null
    if (inlineSummary) {
      setSummary(null)
      setForbidden(false)
      setLoading(false)
      return
    }
    if (skipped) {
      setLoading(false)
      return
    }
    if (dashboardBootstrapState !== "fallback" || !teamId) return
    let cancelled = false
    setLoading(true)
    setForbidden(false)
    fetchReadinessSummaryOnce(teamId)
      .then((r) => {
        if (cancelled) return
        if ("forbidden" in r) {
          setForbidden(true)
          setSummary(null)
          return
        }
        setForbidden(false)
        setSummary(r.summary)
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null)
          setForbidden(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId, dashboardBootstrapState, readinessFromBootstrap])

  const displaySummary = okSummary ?? summary

  if (dashboardBootstrapState === "loading") {
    return (
      <Card
        className="h-full rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
          <CardTitle
            className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold"
            style={{ color: "rgb(var(--text))" }}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
            Roster Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[100px] items-center justify-center px-4 pb-4 md:px-6 md:pb-6">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  if (okSkipped) return null

  if (forbidden) return null

  if (loading) {
    return (
      <Card
        className="h-full rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
          <CardTitle
            className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold"
            style={{ color: "rgb(var(--text))" }}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
            Roster Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[100px] items-center justify-center px-4 pb-4 md:px-6 md:pb-6">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  if (!displaySummary) return null

  return (
    <Card
      className="h-full rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
      style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
    >
      <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
        <CardTitle className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold" style={{ color: "rgb(var(--text))" }}>
          <ClipboardCheck className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
          Roster Readiness
        </CardTitle>
        <Link href={readinessHref} className="shrink-0">
          <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium md:h-7 md:px-2" style={{ color: "rgb(var(--accent))" }}>
            View
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>{displaySummary.total}</span>
          <span className="text-sm" style={{ color: "rgb(var(--muted))" }}>players</span>
        </div>
        <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
          <span className="font-medium text-green-600">{displaySummary.readyCount} ready</span>
          {displaySummary.incompleteCount > 0 && (
            <> · <span className="font-medium text-amber-600">{displaySummary.incompleteCount} need attention</span></>
          )}
        </p>
        {displaySummary.incompleteCount > 0 && (
          <Link href={readinessHref}>
            <Button size="sm" variant="outline" className="mt-2 text-xs">
              Open Readiness tab
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
