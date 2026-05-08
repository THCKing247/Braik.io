import { DashboardRouteTransitionPulse } from "@/components/portal/dashboard-route-skeletons"

/** AD segment only — nav from layout; avoid duplicating a full-viewport gate (PERFORMANCE_GUIDELINES.md §C). */
export default function DashboardLoading() {
  return <DashboardRouteTransitionPulse aria-label="Loading organization portal" />
}
