"use client"

import { useEffect, useMemo } from "react"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type {
  DashboardBootstrapDeferredCorePayload,
  DashboardBootstrapDeferredHeavyPayload,
  FullDashboardBootstrapPayload,
} from "@/lib/dashboard/dashboard-bootstrap-types"
import {
  mergeDashboardBootstrapDeferredCore,
  mergeDashboardBootstrapDeferredHeavy,
} from "@/lib/dashboard/merge-dashboard-bootstrap"
import { readLightweightMemoryRaw, writeLightweightMemory } from "@/lib/api-client/lightweight-fetch-memory"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

/** Light payload can stay warm across short navigations. */
export const DASHBOARD_BOOTSTRAP_STALE_MS = 90 * 1000

/** Delay before loading deferred core if the home deferred zone is not yet visible (ms). */
export const DEFERRED_HOME_FALLBACK_DELAY_MS = 700

/** After core merges, wait this long before fetching heavy (depth chart) so first paint stays idle (ms). */
export const DEFERRED_HEAVY_AFTER_CORE_MS = 450

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
/** Synchronous guard so two kicks in one tick cannot both fetch core. */
const coreMergeInFlight = new Set<string>()
const heavyMergeInFlight = new Set<string>()
const heavyScheduleTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

async function fetchBootstrapDeferredCore(teamId: string): Promise<DashboardBootstrapDeferredCorePayload> {
  const res = await fetchWithTimeout(
    `/api/dashboard/bootstrap-deferred-core?teamId=${encodeURIComponent(teamId)}`,
    { credentials: "same-origin" }
  )
  if (!res.ok) {
    throw new Error(`bootstrap-deferred-core ${res.status}`)
  }
  return (await res.json()) as DashboardBootstrapDeferredCorePayload
}

async function fetchBootstrapDeferredHeavy(teamId: string): Promise<DashboardBootstrapDeferredHeavyPayload> {
  const res = await fetchWithTimeout(
    `/api/dashboard/bootstrap-deferred-heavy?teamId=${encodeURIComponent(teamId)}`,
    { credentials: "same-origin" }
  )
  if (!res.ok) {
    throw new Error(`bootstrap-deferred-heavy ${res.status}`)
  }
  return (await res.json()) as DashboardBootstrapDeferredHeavyPayload
}

function scheduleHeavyAfterCore(teamId: string, queryClient: QueryClient): void {
  const t = teamId.trim()
  if (!t) return
  const prev = heavyScheduleTimers.get(t)
  if (prev != null) clearTimeout(prev)
  const timer = setTimeout(() => {
    heavyScheduleTimers.delete(t)
    void kickDeferredHeavyMerge(t, queryClient)
  }, DEFERRED_HEAVY_AFTER_CORE_MS)
  heavyScheduleTimers.set(t, timer)
}

/**
 * Fetches deferred-core and merges. Schedules deferred-heavy after {@link DEFERRED_HEAVY_AFTER_CORE_MS}.
 * No-ops if core already merged or request in flight.
 */
export function kickDeferredCoreMerge(teamId: string, queryClient: QueryClient): void {
  const t = teamId.trim()
  if (!t) return
  const pre = queryClient.getQueryData(dashboardBootstrapQueryKey(t)) as FullDashboardBootstrapPayload | undefined
  if (!pre?.deferredPending) return
  if (coreMergeInFlight.has(t)) return
  coreMergeInFlight.add(t)

  void (async () => {
    try {
      const core = await fetchBootstrapDeferredCore(t)
      queryClient.setQueryData(dashboardBootstrapQueryKey(t), (prev: FullDashboardBootstrapPayload | undefined) => {
        if (!prev?.deferredPending) return prev
        if (prev.dashboard?.team?.id !== t) return prev
        const merged = mergeDashboardBootstrapDeferredCore(prev, core)
        writeLightweightMemory(dashboardBootstrapMemoryKey(t), merged)
        return merged
      })
      scheduleHeavyAfterCore(t, queryClient)
    } catch {
      queryClient.setQueryData(dashboardBootstrapQueryKey(t), (prev: FullDashboardBootstrapPayload | undefined) => {
        if (!prev?.deferredPending) return prev
        if (prev.dashboard?.team?.id !== t) return prev
        return { ...prev, deferredPending: false, deferredHeavyPending: false }
      })
    } finally {
      coreMergeInFlight.delete(t)
    }
  })()
}

export function kickDeferredHeavyMerge(teamId: string, queryClient: QueryClient): void {
  const t = teamId.trim()
  if (!t) return
  const pre = queryClient.getQueryData(dashboardBootstrapQueryKey(t)) as FullDashboardBootstrapPayload | undefined
  if (pre?.deferredHeavyPending !== true) return
  if (heavyMergeInFlight.has(t)) return
  heavyMergeInFlight.add(t)

  void (async () => {
    try {
      const heavy = await fetchBootstrapDeferredHeavy(t)
      queryClient.setQueryData(dashboardBootstrapQueryKey(t), (prev: FullDashboardBootstrapPayload | undefined) => {
        if (!prev || prev.deferredHeavyPending !== true) return prev
        if (prev.dashboard?.team?.id !== t) return prev
        const merged = mergeDashboardBootstrapDeferredHeavy(prev, heavy)
        writeLightweightMemory(dashboardBootstrapMemoryKey(t), merged)
        return merged
      })
    } catch {
      /* depth tab can load lazily elsewhere */
    } finally {
      heavyMergeInFlight.delete(t)
    }
  })()
}

export async function fetchDashboardBootstrap(teamId: string, queryClient: QueryClient): Promise<FullDashboardBootstrapPayload> {
  const key = teamId.trim()
  if (!key) throw new Error("teamId required")

  const existing = lightInflight.get(key)
  if (existing) return existing

  const p = (async () => {
    const qk = dashboardBootstrapQueryKey(key)
    const prev = queryClient.getQueryData(qk) as FullDashboardBootstrapPayload | undefined

    const coreDone = prev?.deferredPending === false
    const heavyDone =
      prev?.deferredHeavyPending === false ||
      (prev?.deferredPending === false && prev?.deferredHeavyPending === undefined)
    if (coreDone && heavyDone && prev?.dashboard?.team?.id === key) {
      const [light, core, heavy] = await Promise.all([
        fetchBootstrapLight(key),
        fetchBootstrapDeferredCore(key),
        fetchBootstrapDeferredHeavy(key),
      ])
      const merged = mergeDashboardBootstrapDeferredHeavy(mergeDashboardBootstrapDeferredCore(light, core), heavy)
      writeLightweightMemory(dashboardBootstrapMemoryKey(key), merged)
      return merged
    }

    const light = await fetchBootstrapLight(key)
    /**
     * Deferred-core can merge via `kickDeferredCoreMerge` while this await is in flight.
     * If we return `light` here, we overwrite the merged cache and reset `deferredPending`,
     * leaving calendar / notifications / announcements stuck in bootstrapLoading forever.
     */
    const afterParallelMerge = queryClient.getQueryData(qk) as FullDashboardBootstrapPayload | undefined
    if (
      afterParallelMerge?.deferredPending === false &&
      afterParallelMerge.dashboard?.team?.id === key
    ) {
      writeLightweightMemory(dashboardBootstrapMemoryKey(key), afterParallelMerge)
      return afterParallelMerge
    }

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
      /**
       * Memory snapshot is a hint only — treat as stale so the first fetch after navigation
       * always runs when the query cache is empty (e.g. AD portal → team dashboard client nav).
       * If React Query already has data for this key, initialData is ignored.
       */
      initialDataUpdatedAt: p ? 0 : undefined,
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
    return () => {
      if (!tid) return
      const tm = heavyScheduleTimers.get(tid)
      if (tm != null) clearTimeout(tm)
      heavyScheduleTimers.delete(tid)
    }
  }, [tid])

  return query
}

export function invalidateDashboardBootstrap(qc: QueryClient, teamId: string) {
  return qc.invalidateQueries({ queryKey: dashboardBootstrapQueryKey(teamId) })
}
