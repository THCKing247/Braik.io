/**
 * Next.js App Router prefetches visible `<Link>` RSC payloads by default.
 * Team-scoped dashboard routes often trigger large client trees + data hooks; use the return value as
 * `prefetch={...}` on sidebar, strips, and cards so hover/idle does not pull every segment’s RSC.
 *
 * **Default prefetch stays on** for relatively light routes (e.g. `/dashboard/profile`, `/dashboard/support`)
 * where a small RSC payload is acceptable.
 */
const HEAVY_DASHBOARD_PREFIXES = [
  "/dashboard/ad",
  "/dashboard/schedule",
  "/dashboard/messages",
  "/dashboard/calendar",
  "/dashboard/roster",
  "/dashboard/documents",
  "/dashboard/playbooks",
  "/dashboard/inventory",
  "/dashboard/study-guides",
  "/dashboard/weight-room",
  "/dashboard/health",
  "/dashboard/stats",
  "/dashboard/fundraising",
  "/dashboard/game-video",
  "/dashboard/settings",
  "/dashboard/announcements",
  "/dashboard/program-intelligence",
  "/dashboard/collections",
  "/dashboard/film",
  "/dashboard/recruiting",
  "/dashboard/ai-assistant",
  "/dashboard/payments",
  "/dashboard/invoice",
  "/dashboard/subscription",
  "/dashboard/director",
  "/dashboard/admin",
  "/dashboard/invites",
] as const

export function prefetchPropForDashboardScheduleHref(href: string): boolean | undefined {
  const pathOnly = (href.split("#")[0] ?? href).split("?")[0] ?? ""
  if (pathOnly === "/dashboard") {
    return false
  }
  for (const prefix of HEAVY_DASHBOARD_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)) {
      return false
    }
  }
  return undefined
}
