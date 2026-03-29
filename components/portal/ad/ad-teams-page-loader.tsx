"use client"

import { useRouter } from "next/navigation"
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

/**
 * Teams page: layout + table shell mount immediately; fetch runs in background.
 * Cached data (prefetch + prior visit) shows instantly via placeholderData.
 */
export function AdTeamsPageLoader() {
  const router = useRouter()
  const mountT0 = useRef(typeof performance !== "undefined" ? performance.now() : 0)
  const loggedPaint = useRef(false)
  const loggedDataReady = useRef(false)

  const q = useQuery({
    queryKey: AD_TEAMS_TABLE_QUERY_KEY,
    queryFn: ({ signal }) => fetchAdTeamsTableQuery(signal),
    staleTime: AD_TEAMS_TABLE_STALE_MS,
    gcTime: AD_TEAMS_TABLE_GC_MS,
    placeholderData: (previousData) => previousData,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const teamsData = q.data
  const isPending = q.isPending
  const isFetching = q.fetchStatus === "fetching"
  const isError = q.isError
  const queryError = q.error

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
      rowCount: teamsData.length,
      isPlaceholderData: q.isPlaceholderData,
    })
  }, [teamsData, q.isPlaceholderData])

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

  const initialLoading = teamsData === undefined && (isPending || isFetching)

  return (
    <AdTeamsPageClient
      teams={teamsData ?? []}
      initialLoading={initialLoading}
      isRefreshing={Boolean(teamsData !== undefined && isFetching && !initialLoading)}
    />
  )
}
