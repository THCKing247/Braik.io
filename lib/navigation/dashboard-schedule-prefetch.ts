/**
 * Next.js App Router prefetches visible `<Link>` RSC payloads by default.
 * Heavy dashboard areas (sidebar, quick actions, schedule strip) should pass the return value as
 * `prefetch={...}` so first paint does not request every sub-route's RSC payload.
 *
 * Light routes (e.g. profile, settings, support) leave `undefined` so default prefetch stays on.
 */
const HEAVY_DASHBOARD_PREFIXES = [
  "/dashboard/schedule",
  "/dashboard/messages",
  "/dashboard/calendar",
  "/dashboard/roster",
  "/dashboard/documents",
  "/dashboard/playbooks",
  /** First paint: do not prefetch RSC for tools not needed until navigated */
  "/dashboard/inventory",
  "/dashboard/study-guides",
  "/dashboard/weight-room",
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
