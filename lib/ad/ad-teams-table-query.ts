import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { AD_TEAMS_TABLE_QUERY_KEY } from "@/lib/ad/load-ad-teams-page-rows"
import { adTeamsFlowPerfClient } from "@/lib/ad/ad-teams-table-perf-client"
import { adPortalClientPerf } from "@/lib/debug/ad-portal-client-perf"

const FETCH_TIMEOUT_MS = 12_000

/** Reuse cached teams across navigations; background refetch when stale. */
export const AD_TEAMS_TABLE_STALE_MS = 5 * 60_000

export const AD_TEAMS_TABLE_GC_MS = 45 * 60_000

export { AD_TEAMS_TABLE_QUERY_KEY }

/**
 * GET /api/ad/pages/teams-table — shared by useQuery and prefetchQuery.
 * @param signal optional; prefetch may omit (uses timeout-only abort).
 */
export async function fetchAdTeamsTableQuery(signal?: AbortSignal): Promise<TeamRow[]> {
  const ac = new AbortController()
  const timeoutId = window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  const onParentAbort = () => ac.abort()
  if (signal) {
    if (signal.aborted) ac.abort()
    else signal.addEventListener("abort", onParentAbort, { once: true })
  }
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
    adTeamsFlowPerfClient("teams_table_fetch_total_ms", {
      ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
      rowCount: Array.isArray(json.teams) ? json.teams.length : 0,
    })
    return json.teams
  } finally {
    signal?.removeEventListener("abort", onParentAbort)
    clearTimeout(timeoutId)
  }
}
