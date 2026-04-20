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
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"

/**
 * Teams page: initial rows come from the server component (first paint).
 * React Query keeps the same cache key as GET /api/ad/pages/teams-table for background refresh.
 */
export function AdTeamsPageLoader({ initialTeams }: { initialTeams: TeamRow[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const orgBase = (() => {
    const match = (pathname ?? "").match(/^\/org\/([^/]+)/)
    return match ? `/org/${match[1]}` : null
  })()
  const mountT0 = useRef(typeof performance !== "undefined" ? performance.now() : 0)
  const loggedPaint = useRef(false)
  const loggedDataReady = useRef(false)

  const teamsQ = useQuery({
    queryKey: AD_TEAMS_TABLE_QUERY_KEY,
    queryFn: ({ signal }) => fetchAdTeamsTableQuery(signal),
    initialData: initialTeams,
    staleTime: AD_TEAMS_TABLE_STALE_MS,
    gcTime: AD_TEAMS_TABLE_GC_MS,
    placeholderData: (previousData) => previousData,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const teamsData = teamsQ.data ?? initialTeams
  const isError = teamsQ.isError
  const queryError = teamsQ.error

  const isRefreshing = Boolean(teamsData !== undefined && teamsQ.isFetching && !teamsQ.isPending)

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
      source: "server_initial_and_rq",
    })
  }, [teamsData])

  useEffect(() => {
    if (!isError || !queryError) return
    const status = (queryError as Error & { status?: number })?.status
    if (status === 401) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(orgBase ? `${orgBase}/teams` : "/dashboard/ad/teams")}`)
      return
    }
    if (status === 403) {
      router.replace("/dashboard")
    }
  }, [isError, queryError, router, orgBase])

  if (isError && teamsData === undefined) {
    const status = (queryError as Error & { status?: number })?.status
    if (status === 401 || status === 403) {
      return null
    }
    return <p className="text-[#212529]">Could not load teams.</p>
  }

  return (
    <AdTeamsPageClient
      teams={teamsData ?? []}
      initialLoading={false}
      isRefreshing={isRefreshing}
    />
  )
}
