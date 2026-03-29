/**
 * Team dashboard layout — no server-side session wait. Shell (nav, teams, guards) loads on the client
 * via GET /api/dashboard/shell after first paint.
 */
import { DashboardTeamShellGate } from "@/components/portal/dashboard-team-shell-gate"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardTeamShellGate>{children}</DashboardTeamShellGate>
}
