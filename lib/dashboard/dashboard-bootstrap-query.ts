"use client"

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import type { FullDashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import { readLightweightMemoryRaw, writeLightweightMemory } from "@/lib/api-client/lightweight-fetch-memory"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

export const DASHBOARD_BOOTSTRAP_STALE_MS = 5 * 60 * 1000

export function dashboardBootstrapQueryKey(teamId: string) {
  return ["dashboard-bootstrap", teamId.trim()] as const
}

export function dashboardBootstrapMemoryKey(teamId: string): string {
  return `lw-mem:dashboard-bootstrap-full:${teamId.trim()}`
}

export function peekDashboardBootstrapMemory(teamId: string): FullDashboardBootstrapPayload | null {
  const raw = readLightweightMemoryRaw(dashboardBootstrapMemoryKey(teamId))
  if (!raw) return null
  return raw.value as FullDashboardBootstrapPayload
}

const inflight = new Map<string, Promise<FullDashboardBootstrapPayload>>()

export async function fetchDashboardBootstrap(teamId: string): Promise<FullDashboardBootstrapPayload> {
  const key = teamId.trim()
  if (!key) throw new Error("teamId required")
  const existing = inflight.get(key)
  if (existing) return existing
  const p = (async () => {
    const res = await fetchWithTimeout(
      `/api/dashboard/bootstrap?teamId=${encodeURIComponent(key)}`,
      { credentials: "same-origin" }
    )
    if (!res.ok) {
      const err = new Error(`bootstrap ${res.status}`)
      throw err
    }
    const data = (await res.json()) as FullDashboardBootstrapPayload
    writeLightweightMemory(dashboardBootstrapMemoryKey(key), data)
    return data
  })().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export function useDashboardBootstrapQuery(teamId: string) {
  const queryClient = useQueryClient()
  const tid = teamId.trim()
  const initialPeek = tid ? peekDashboardBootstrapMemory(tid) : null

  const query = useQuery({
    queryKey: tid ? dashboardBootstrapQueryKey(tid) : (["dashboard-bootstrap", "__none__"] as const),
    queryFn: () => fetchDashboardBootstrap(tid),
    enabled: Boolean(tid),
    staleTime: DASHBOARD_BOOTSTRAP_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: initialPeek ?? undefined,
  })

  useEffect(() => {
    const d = query.data
    const pid = d?.dashboard?.team?.programId?.trim()
    if (!pid) return
    void queryClient.prefetchQuery({
      queryKey: ["program-depth-chart", pid],
      queryFn: async () => {
        const res = await fetch(`/api/programs/${encodeURIComponent(pid)}/depth-chart`, {
          credentials: "same-origin",
        })
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      },
      staleTime: DASHBOARD_BOOTSTRAP_STALE_MS,
    })
  }, [query.data, queryClient])

  return query
}

export function invalidateDashboardBootstrap(qc: QueryClient, teamId: string) {
  return qc.invalidateQueries({ queryKey: dashboardBootstrapQueryKey(teamId) })
}
