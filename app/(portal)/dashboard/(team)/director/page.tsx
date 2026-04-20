import { redirect } from "next/navigation"
import { resolveCurrentUserOrganizationPortalPath } from "@/lib/navigation/organization-portal-redirect"

/** Legacy URL: football program staffing now lives under organization portal → Coaches. */
export default async function LegacyDirectorRouteRedirect() {
  const destination = await resolveCurrentUserOrganizationPortalPath("/coaches")
  redirect(destination ?? "/dashboard")
}
