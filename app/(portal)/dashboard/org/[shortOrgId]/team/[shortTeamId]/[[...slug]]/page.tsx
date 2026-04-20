import { redirect } from "next/navigation"

/**
 * Canonical short-ID team routes are handled by middleware rewrite into existing team pages.
 * If this route is hit directly without rewrite (unexpected), send user to dashboard root.
 */
export default function CanonicalTeamDashboardFallbackPage() {
  redirect("/dashboard")
}
