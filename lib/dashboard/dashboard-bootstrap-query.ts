"use client"

import { useEffect, useMemo } from "react"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type {
  DashboardBootstrapDeferredPayload,
  FullDashboardBootstrapPayload,
} from "@/lib/dashboard/dashboard-bootstrap-types"
import { mergeDashboardBootstrapDeferred } from "@/lib/dashboard/merge-dashboard-bootstrap"
import { readLightweightMemoryRaw, writeLightweightMemory } from "@/lib/api-client/lightweight-fetch-memory"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

/** Light payload can stay warm across short navigations; explicit refetch reloads light + deferred in parallel. */
export const DASHBOARD_BOOTSTRAP_STALE_MS = 90 * 1000

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

const lightInflight = new Map<string, Promise<FullDashboardBootstrapPayload>>()
const deferredMergeInflight = new Map<string, Promise<void>>()

async function fetchBootstrapLight(teamId: string): Promise<FullDashboardBootstrapPayload> {
  const res = await fetchWithTimeout(
    `/api/dashboard/bootstrap-light?teamId=${encodeURIComponent(teamId)}`,
    { credentials: "same-origin" }
  )
  if (!res.ok) {
    throw new Error(`bootstrap-light ${res.status}`)
  }
  return (await res.json()) as FullDashboardBootstrapPayload
}

async function fetchBootstrapDeferred(teamId: string): Promise<DashboardBootstrapDeferredPayload> {
  const res = await fetchWithTimeout(
    `/api/dashboard/bootstrap-deferred?teamId=${encodeURIComponent(teamId)}`,
    { credentials: "same-origin" }
  )
  if (!res.ok) {
    throw new Error(`bootstrap-deferred ${res.status}`)
  }
  return (await res.json()) as DashboardBootstrapDeferredPayload
}

export function kickDeferredBootstrapMerge(teamId: string, queryClient: QueryClient): void {
  const t = teamId.trim()
  if (!t) return
  if (deferredMergeInflight.has(t)) return

  const job = (async () => {
    try {
      const deferred = await fetchBootstrapDeferred(t)
      queryClient.setQueryData(dashboardBootstrapQueryKey(t), (prev: FullDashboardBootstrapPayload | undefined) => {
        if (!prev?.deferredPending) return prev
        if (prev.dashboard?.team?.id !== t) return prev
        const merged = mergeDashboardBootstrapDeferred(prev, deferred)
        writeLightweightMemory(dashboardBootstrapMemoryKey(t), merged)
        return merged
      })
    } catch {
      /* roster page and cards fall back to their own fetches */
    } finally {
      deferredMergeInflight.delete(t)
    }
  })()

  deferredMergeInflight.set(t, job)
}

export async function fetchDashboardBootstrap(teamId: string, queryClient: QueryClient): Promise<FullDashboardBootstrapPayload> {
  const key = teamId.trim()
  if (!key) throw new Error("teamId required")

  const existing = lightInflight.get(key)
  if (existing) return existing

  const p = (async () => {
    const qk = dashboardBootstrapQueryKey(key)
    const prev = queryClient.getQueryData(qk) as FullDashboardBootstrapPayload | undefined

    if (prev?.deferredPending === false && prev.dashboard?.team?.id === key) {
      const [light, deferred] = await Promise.all([fetchBootstrapLight(key), fetchBootstrapDeferred(key)])
      const merged = mergeDashboardBootstrapDeferred(light, deferred)
      writeLightweightMemory(dashboardBootstrapMemoryKey(key), merged)
      return merged
    }

    const light = await fetchBootstrapLight(key)
    writeLightweightMemory(dashboardBootstrapMemoryKey(key), light)
    return light
  })().finally(() => lightInflight.delete(key))

  lightInflight.set(key, p)
  return p
}

export function useDashboardBootstrapQuery(teamId: string) {
  const queryClient = useQueryClient()
  const tid = teamId.trim()
  const peekInit = useMemo(() => {
    const p = tid ? peekDashboardBootstrapMemory(tid) : null
    return {
      initialData: p ?? undefined,
      initialDataUpdatedAt: p ? Date.now() : undefined,
    }
  }, [tid])

  const query = useQuery({
    queryKey: tid ? dashboardBootstrapQueryKey(tid) : (["dashboard-bootstrap", "__none__"] as const),
    queryFn: () => fetchDashboardBootstrap(tid, queryClient),
    enabled: Boolean(tid),
    staleTime: DASHBOARD_BOOTSTRAP_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: peekInit.initialData,
    initialDataUpdatedAt: peekInit.initialDataUpdatedAt,
  })

  useEffect(() => {
    if (!tid || !query.data?.deferredPending) return
    kickDeferredBootstrapMerge(tid, queryClient)
  }, [tid, query.data?.deferredPending, queryClient])

  return query
}

export function invalidateDashboardBootstrap(qc: QueryClient, teamId: string) {
  return qc.invalidateQueries({ queryKey: dashboardBootstrapQueryKey(teamId) })
}
