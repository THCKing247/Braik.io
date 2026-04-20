import { redirect } from "next/navigation"
import { resolveCurrentUserOrganizationPortalPath } from "@/lib/navigation/organization-portal-redirect"

/**
 * Server-first: real team rows are loaded for the initial HTML (same access checks as
 * GET /api/ad/pages/teams-table). Client React Query refreshes in the background.
 */
export default async function AdTeamsPage() {
  const destination = await resolveCurrentUserOrganizationPortalPath("/teams")
  redirect(destination ?? "/dashboard")
}
