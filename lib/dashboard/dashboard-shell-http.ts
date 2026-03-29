import type { NextResponse } from "next/server"

/** User-specific shell; same pattern as dashboard bootstrap list endpoints. */
export const DASHBOARD_SHELL_CACHE_CONTROL =
  "private, max-age=0, s-maxage=30, stale-while-revalidate=60"

export function applyDashboardShellCacheHeaders(res: Pick<NextResponse, "headers">): void {
  res.headers.set("Cache-Control", DASHBOARD_SHELL_CACHE_CONTROL)
}
