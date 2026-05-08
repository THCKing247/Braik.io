import type { DashboardShellPayload } from "@/lib/dashboard/dashboard-shell-payload"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import { ApiError } from "@/lib/api/core/api-error"

/** Thrown when GET /api/dashboard/shell returns 401 — consumers redirect to login. */
export class DashboardShellUnauthorizedError extends Error {
  override name = "DashboardShellUnauthorizedError"
}

/** Raw shell round-trip — callers log timing with `response.status` before parsing. */
export async function fetchDashboardShellResponse(): Promise<Response> {
  return fetchWithTimeout("/api/dashboard/shell", {
    credentials: "include",
  })
}

export async function parseDashboardShellResponse(res: Response): Promise<DashboardShellPayload> {
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    throw new DashboardShellUnauthorizedError("Unauthorized")
  }
  if (!res.ok) {
    throw new ApiError(`shell ${res.status}`, res.status, body)
  }
  return body as DashboardShellPayload
}
