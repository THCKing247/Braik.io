import type { NextResponse } from "next/server"

/** User-specific dashboard payloads; short CDN-style freshness without exposing private data publicly. */
export const DASHBOARD_BOOTSTRAP_CACHE_CONTROL =
  "private, max-age=0, s-maxage=30, stale-while-revalidate=300"

export function applyDashboardBootstrapCacheHeaders(res: Pick<NextResponse, "headers">): void {
  res.headers.set("Cache-Control", DASHBOARD_BOOTSTRAP_CACHE_CONTROL)
}
