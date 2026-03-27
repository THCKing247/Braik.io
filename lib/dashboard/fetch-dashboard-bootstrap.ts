import type { DashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import { readLightweightMemoryRaw, writeLightweightMemory } from "@/lib/api-client/lightweight-fetch-memory"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

/** Same-tab: serve from memory while younger than this; older entries still paint instantly then refresh in the background. */
const MEMORY_FRESH_MS = 6000

export function dashboardBootstrapMemoryKey(teamId: string): string {
  return `lw-mem:dashboard-bootstrap:${teamId.trim()}`
}

/** Synchronous read for instant paint before the first network round-trip. */
export function peekDashboardBootstrapMemory(teamId: string): DashboardBootstrapPayload | null {
  const raw = readLightweightMemoryRaw(dashboardBootstrapMemoryKey(teamId))
  if (!raw) return null
  return raw.value as DashboardBootstrapPayload
}

/** Coalesce concurrent bootstrap requests (Strict Mode double mount, fast remounts). */
const inflight = new Map<string, Promise<DashboardBootstrapPayload | null>>()

async function fetchFromNetwork(teamId: string): Promise<DashboardBootstrapPayload | null> {
  try {
    const res = await fetchWithTimeout(
      `/api/dashboard/bootstrap?teamId=${encodeURIComponent(teamId)}`,
      { credentials: "same-origin" }
    )
    if (!res.ok) return null
    const data = (await res.json()) as DashboardBootstrapPayload
    writeLightweightMemory(dashboardBootstrapMemoryKey(teamId), data)
    return data
  } catch {
    return null
  }
}

export async function fetchDashboardBootstrap(teamId: string): Promise<DashboardBootstrapPayload | null> {
  const key = teamId.trim()
  if (!key) return null

  const cached = readLightweightMemoryRaw(dashboardBootstrapMemoryKey(key))
  if (cached && cached.ageMs < MEMORY_FRESH_MS) {
    return cached.value as DashboardBootstrapPayload
  }

  if (cached && cached.ageMs >= MEMORY_FRESH_MS) {
    if (!inflight.has(key)) {
      const p = fetchFromNetwork(key).finally(() => inflight.delete(key))
      inflight.set(key, p)
    }
    return cached.value as DashboardBootstrapPayload
  }

  const existing = inflight.get(key)
  if (existing) return existing

  const p = fetchFromNetwork(key).finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}
