"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { AdTeamsPageClient } from "@/components/portal/ad/ad-teams-page-client"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { AD_TEAMS_TABLE_QUERY_KEY } from "@/lib/ad/load-ad-teams-page-rows"
import { adTeamsFlowPerfClient } from "@/lib/ad/ad-teams-table-perf-client"
import { adPortalClientPerf } from "@/lib/debug/ad-portal-client-perf"

const FETCH_TIMEOUT_MS = 12_000

async function fetchAdTeamsTable(signal: AbortSignal): Promise<TeamRow[]> {
  const ac = new AbortController()
  const onParentAbort = () => ac.abort()
  signal.addEventListener("abort", onParentAbort, { once: true })
  const timeoutId = window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0
    adPortalClientPerf("teams_table_fetch_start")
    const res = await fetch("/api/ad/pages/teams-table", {
      credentials: "include",
      cache: "default",
      signal: ac.signal,
    })
    adPortalClientPerf("teams_table_fetch_done", {
      ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
      status: res.status,
    })
    if (!res.ok) {
      const err = new Error(`teams-table ${res.status}`)
      ;(err as Error & { status?: number }).status = res.status
      throw err
    }
    const json = (await res.json()) as { teams: TeamRow[] }
    return json.teams
  } finally {
    signal.removeEventListener("abort", onParentAbort)
    clearTimeout(timeoutId)
  }
}

export function AdTeamsPageLoader() {
  const router = useRouter()
  const mountT0 = useRef(typeof performance !== "undefined" ? performance.now() : 0)
  const loggedSettled = useRef(false)

  const q = useQuery({
    queryKey: AD_TEAMS_TABLE_QUERY_KEY,
    queryFn: ({ signal }) => fetchAdTeamsTable(signal),
    staleTime: 90_000,
    gcTime: 20 * 60_000,
    retry: 1,
    // Visibility handler in AdTeamsPageClient invalidates explicitly; avoid duplicate refetch with window focus.
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!q.isFetched || loggedSettled.current) return
    loggedSettled.current = true
    adTeamsFlowPerfClient("teams_table_loader_to_first_fetch_ms", {
      queryStatus: q.status,
      ms: Math.round(performance.now() - mountT0.current),
      rowCount: Array.isArray(q.data) ? q.data.length : 0,
    })
  }, [q.isFetched, q.status, q.data])

  if (q.isPending) {
    return <AdTeamsPageClient teams={[]} initialLoading />
  }

  if (q.isError) {
    const status = (q.error as Error & { status?: number })?.status
    if (status === 401) {
      router.replace("/login?callbackUrl=/dashboard/ad/teams")
      return null
    }
    if (status === 403) {
      router.replace("/dashboard")
      return null
    }
    return <p className="text-[#212529]">Could not load teams.</p>
  }

  return <AdTeamsPageClient teams={q.data ?? []} />
}
