import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import type {
  DashboardBootstrapDeferredCorePayload,
  DashboardBootstrapDeferredHeavyPayload,
  FullDashboardBootstrapPayload,
} from "@/lib/dashboard/dashboard-bootstrap-types"

/** Staged bootstrap phase 1 — behavior matches legacy inline fetch (non-OK → `bootstrap-light ${status}`). */
export async function fetchDashboardBootstrapLight(teamId: string): Promise<FullDashboardBootstrapPayload> {
  const res = await fetchWithTimeout(`/api/dashboard/bootstrap-light?teamId=${encodeURIComponent(teamId)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) {
    throw new Error(`bootstrap-light ${res.status}`)
  }
  return (await res.json()) as FullDashboardBootstrapPayload
}

export async function fetchDashboardBootstrapDeferredCore(
  teamId: string
): Promise<DashboardBootstrapDeferredCorePayload> {
  const res = await fetchWithTimeout(`/api/dashboard/bootstrap-deferred-core?teamId=${encodeURIComponent(teamId)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) {
    throw new Error(`bootstrap-deferred-core ${res.status}`)
  }
  return (await res.json()) as DashboardBootstrapDeferredCorePayload
}

export async function fetchDashboardBootstrapDeferredHeavy(
  teamId: string
): Promise<DashboardBootstrapDeferredHeavyPayload> {
  const res = await fetchWithTimeout(`/api/dashboard/bootstrap-deferred-heavy?teamId=${encodeURIComponent(teamId)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) {
    throw new Error(`bootstrap-deferred-heavy ${res.status}`)
  }
  return (await res.json()) as DashboardBootstrapDeferredHeavyPayload
}
