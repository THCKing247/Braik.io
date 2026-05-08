import { ApiError } from "@/lib/api/core/api-error"
import { fetchJson } from "@/lib/api/core/fetch-json"
import type {
  DashboardBootstrapDeferredCorePayload,
  DashboardBootstrapDeferredHeavyPayload,
  FullDashboardBootstrapPayload,
} from "@/lib/dashboard/dashboard-bootstrap-types"

/** Staged bootstrap phase 1 — behavior matches legacy inline fetch (non-OK → `bootstrap-light ${status}`). */
export async function fetchDashboardBootstrapLight(teamId: string): Promise<FullDashboardBootstrapPayload> {
  try {
    return await fetchJson<FullDashboardBootstrapPayload>(
      `/api/dashboard/bootstrap-light?teamId=${encodeURIComponent(teamId)}`,
      { credentials: "same-origin" }
    )
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(`bootstrap-light ${error.status}`)
    }
    throw error
  }
}

export async function fetchDashboardBootstrapDeferredCore(
  teamId: string
): Promise<DashboardBootstrapDeferredCorePayload> {
  try {
    return await fetchJson<DashboardBootstrapDeferredCorePayload>(
      `/api/dashboard/bootstrap-deferred-core?teamId=${encodeURIComponent(teamId)}`,
      { credentials: "same-origin" }
    )
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(`bootstrap-deferred-core ${error.status}`)
    }
    throw error
  }
}

export async function fetchDashboardBootstrapDeferredHeavy(
  teamId: string
): Promise<DashboardBootstrapDeferredHeavyPayload> {
  try {
    return await fetchJson<DashboardBootstrapDeferredHeavyPayload>(
      `/api/dashboard/bootstrap-deferred-heavy?teamId=${encodeURIComponent(teamId)}`,
      { credentials: "same-origin" }
    )
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(`bootstrap-deferred-heavy ${error.status}`)
    }
    throw error
  }
}
