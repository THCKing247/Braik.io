"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { AdTeamsPageClient } from "@/components/portal/ad/ad-teams-page-client"
import {
  AD_TEAMS_TABLE_GC_MS,
  AD_TEAMS_TABLE_QUERY_KEY,
  AD_TEAMS_TABLE_STALE_MS,
  fetchAdTeamsTableQuery,
} from "@/lib/ad/ad-teams-table-query"
import { adTeamsFlowPerfClient } from "@/lib/ad/ad-teams-table-perf-client"
import {
  adPortalBootstrapIncludeTeamsTable,
  useAdPortalBootstrapQuery,
} from "@/lib/app/ad-portal-bootstrap-query"

/**
 * Teams page: shares one React Query subscription with the AD shell for bootstrap+teams when
 * `includeTeamsTable=1`. Falls back to GET /api/ad/pages/teams-table only if bootstrap has no rows.
 */
export function AdTeamsPageLoader() {
  const router = useRouter()
  const pathname = usePathname()
  const mountT0 = useRef(typeof performance !== "undefined" ? performance.now() : 0)
  const loggedPaint = useRef(false)
  const loggedDataReady = useRef(false)

  const onTeamsRoute = adPortalBootstrapIncludeTeamsTable(pathname)
  const bootstrapQ = useAdPortalBootstrapQuery()

  const embeddedRows =
    onTeamsRoute && bootstrapQ.isSuccess && Array.isArray(bootstrapQ.data?.teamsTable)
      ? bootstrapQ.data!.teamsTable!
      : null

  const teamsQ = useQuery({
    queryKey: AD_TEAMS_TABLE_QUERY_KEY,
    queryFn: ({ signal }) => fetchAdTeamsTableQuery(signal),
    staleTime: AD_TEAMS_TABLE_STALE_MS,
    gcTime: AD_TEAMS_TABLE_GC_MS,
    placeholderData: (previousData) => previousData,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: onTeamsRoute && bootstrapQ.isFetched && embeddedRows === null,
  })

  const teamsData = embeddedRows ?? teamsQ.data
  const isPending = embeddedRows !== null ? false : teamsQ.isPending
  const isFetching = embeddedRows !== null ? false : teamsQ.fetchStatus === "fetching"
  const isError = embeddedRows === null && teamsQ.isError
  const queryError = teamsQ.error

  useEffect(() => {
    if (loggedPaint.current || typeof window === "undefined") return
    loggedPaint.current = true
    const t0 = performance.now()
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        adTeamsFlowPerfClient("teams_page_first_paint_proxy_ms", {
          ms: Math.round(performance.now() - t0),
          fromMountMs: Math.round(performance.now() - mountT0.current),
        })
      })
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (teamsData === undefined || loggedDataReady.current) return
    loggedDataReady.current = true
    adTeamsFlowPerfClient("teams_page_time_to_data_ms", {
      ms: Math.round(performance.now() - mountT0.current),
      rowCount: Array.isArray(teamsData) ? teamsData.length : 0,
      source: embeddedRows !== null ? "bootstrap" : "teams_table_api",
    })
  }, [teamsData, embeddedRows])

  if (isError && teamsData === undefined) {
    const status = (queryError as Error & { status?: number })?.status
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

  const waitingBootstrap = onTeamsRoute && !bootstrapQ.isFetched
  const waitingFallbackApi =
    onTeamsRoute &&
    bootstrapQ.isFetched &&
    embeddedRows === null &&
    (teamsQ.isPending || teamsQ.isFetching) &&
    teamsData === undefined

  const initialLoading = waitingBootstrap || waitingFallbackApi

  const isRefreshing =
    (embeddedRows !== null && bootstrapQ.isFetching) ||
    (embeddedRows === null && teamsData !== undefined && teamsQ.isFetching && !teamsQ.isPending)

  return (
    <AdTeamsPageClient
      teams={teamsData ?? []}
      initialLoading={initialLoading}
      isRefreshing={isRefreshing}
    />
  )
}
