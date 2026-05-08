import { DashboardRouteTransitionPulse } from "@/components/portal/dashboard-route-skeletons"

/** Main segment only — nav/sidebar stay mounted; avoid a second full-viewport skeleton (PERFORMANCE_GUIDELINES.md §C). */
export default function DashboardLoading() {
  return <DashboardRouteTransitionPulse aria-label="Loading dashboard" />
}
