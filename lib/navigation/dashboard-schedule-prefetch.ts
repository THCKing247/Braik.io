/**
 * Next.js App Router prefetches visible `<Link>` RSC payloads by default.
 * Dashboard schedule is heavy — pass the return value as `prefetch={...}` on any schedule `<Link>`.
 */
export function prefetchPropForDashboardScheduleHref(href: string): boolean | undefined {
  const pathOnly = (href.split("#")[0] ?? href).split("?")[0] ?? ""
  if (pathOnly === "/dashboard/schedule" || pathOnly.startsWith("/dashboard/schedule/")) {
    return false
  }
  return undefined
}
