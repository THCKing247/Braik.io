"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import { buildEngagementHints, type HintCounts } from "@/lib/engagement/dashboard-hints-data"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { readLightweightMemoryRaw, writeLightweightMemory } from "@/lib/api-client/lightweight-fetch-memory"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import { prefetchPropForDashboardScheduleHref } from "@/lib/navigation/dashboard-schedule-prefetch"

type Hint = {
  id: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}

const COACH_ROLES = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])

function hintsMemKey(teamId: string) {
  return `lw-mem:engagement-hints:${teamId.trim()}`
}

function storageKey(teamId: string, hintId: string) {
  return `braik_hint_dismissed:${teamId}:${hintId}`
}

/**
 * Single dismissible setup nudge for coaches on the main dashboard only.
 * Hint counts prefer shell.engagement (merged from bootstrap-deferred-core) — avoids racing/cancelled GET /api/engagement/hints.
 */
export function DashboardEngagementHints({ currentTeamId }: { currentTeamId: string }) {
  const pathname = usePathname()
  const identity = useDashboardShellIdentity()
  const shell = useAppBootstrapOptional()
  const [hints, setHints] = useState<Hint[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissTick, setDismissTick] = useState(0)

  const coachRole = identity.roleUpper
  const showStrip = pathname === "/dashboard" && Boolean(currentTeamId) && COACH_ROLES.has(coachRole)

  const deferredCorePending = shell?.deferredCorePending ?? false
  const engagementCountsKey = useMemo(
    () => JSON.stringify(shell?.payload?.engagement?.counts ?? null),
    [shell?.payload?.engagement?.counts]
  )

  useEffect(() => {
    if (!currentTeamId || !showStrip) {
      setHints([])
      setLoading(false)
      return
    }
    /** Wait for deferred-core merge so shell carries engagement counts (same RPC as /api/engagement/hints). */
    if (deferredCorePending) {
      setHints([])
      setLoading(false)
      return
    }

    if (engagementCountsKey !== "null") {
      try {
        const parsed = JSON.parse(engagementCountsKey) as HintCounts
        if (parsed && typeof parsed === "object") {
          setHints(buildEngagementHints(currentTeamId, parsed))
          setLoading(false)
          return
        }
      } catch {
        /* ignore */
      }
    }

    const mem = readLightweightMemoryRaw(hintsMemKey(currentTeamId))
    if (mem && mem.ageMs < 45_000) {
      const v = mem.value as { hints?: Hint[] }
      if (Array.isArray(v.hints)) {
        setHints(v.hints)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    const ac = new AbortController()
    let cancelled = false
    fetchWithTimeout(`/api/engagement/hints?teamId=${encodeURIComponent(currentTeamId)}`, {
      credentials: "same-origin",
      signal: ac.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled || ac.signal.aborted) return
        if (res.ok && Array.isArray(data.hints)) {
          const list = data.hints as Hint[]
          setHints(list)
          writeLightweightMemory(hintsMemKey(currentTeamId), { hints: list })
        } else {
          setHints([])
        }
      })
      .catch(() => {
        if (!cancelled && !ac.signal.aborted) setHints([])
      })
      .finally(() => {
        if (!cancelled && !ac.signal.aborted) setLoading(false)
      })
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [currentTeamId, showStrip, deferredCorePending, engagementCountsKey])

  const nextHint = useMemo(() => {
    for (const h of hints) {
      if (typeof window === "undefined") continue
      if (window.localStorage.getItem(storageKey(currentTeamId, h.id))) continue
      return h
    }
    return null
  }, [hints, currentTeamId, dismissTick])

  const dismiss = () => {
    if (!nextHint || !currentTeamId) return
    try {
      window.localStorage.setItem(storageKey(currentTeamId, nextHint.id), "1")
    } catch {
      /* ignore */
    }
    setDismissTick((t) => t + 1)
  }

  if (!showStrip || loading || !nextHint) {
    return null
  }

  return (
    <div
      className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:mb-0 lg:mt-0"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{nextHint.title}</p>
        <p className="text-xs text-muted-foreground">{nextHint.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm" variant="default" className="bg-primary text-primary-foreground">
          <Link href={nextHint.ctaHref} prefetch={prefetchPropForDashboardScheduleHref(nextHint.ctaHref)}>
            {nextHint.ctaLabel}
          </Link>
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={dismiss} aria-label="Dismiss hint">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
