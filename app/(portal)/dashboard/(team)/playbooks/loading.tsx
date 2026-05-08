import { DashboardRouteTransitionPulse } from "@/components/portal/dashboard-route-skeletons"

/** TODO(cleanup): Playbook subtree pulls heavy editor chunks — keep route-local skeletons; consider matching playbook grid rows when bundle splits settle. */
export default function PlaybooksLoading() {
  return <DashboardRouteTransitionPulse aria-label="Loading playbooks" />
}
