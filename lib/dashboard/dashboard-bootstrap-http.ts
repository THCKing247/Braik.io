import type { NextResponse } from "next/server"

/**
 * User-specific dashboard payloads — stay `private` (not `public`) so shared edge caches never
 * serve one session’s JSON under the same URL. `s-maxage` + SWR still help repeat loads when
 * the cache key includes credentials / varies by cookie.
 */
export const DASHBOARD_BOOTSTRAP_CACHE_CONTROL =
  "private, max-age=0, s-maxage=60, stale-while-revalidate=300"

export function applyDashboardBootstrapCacheHeaders(res: Pick<NextResponse, "headers">): void {
  res.headers.set("Cache-Control", DASHBOARD_BOOTSTRAP_CACHE_CONTROL)
}
