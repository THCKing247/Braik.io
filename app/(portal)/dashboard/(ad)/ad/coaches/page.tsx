import { redirect } from "next/navigation"
import { resolveCurrentUserOrganizationPortalPath } from "@/lib/navigation/organization-portal-redirect"

/**
 * Coaches data loads via GET /api/ad/bootstrap (teams picklist + coach rows + engagement hints).
 * Layout enforces AD portal access; the API returns 403 if that ever regresses.
 */
export default async function AdCoachesPage() {
  const destination = await resolveCurrentUserOrganizationPortalPath("/coaches")
  redirect(destination ?? "/dashboard")
}
