import { DashboardMainSkeleton } from "@/components/portal/dashboard-route-skeletons"

/** Instant shell while the dashboard layout + page resolve. */
export default function DashboardLoading() {
  return <DashboardMainSkeleton aria-label="Loading dashboard" />
}
