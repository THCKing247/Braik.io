import { redirect } from "next/navigation"
import { resolveCurrentUserOrganizationPortalPath } from "@/lib/navigation/organization-portal-redirect"

/** Legacy route: football program staffing lives on the Coaches tab. */
export default async function AdProgramRedirectPage() {
  const destination = await resolveCurrentUserOrganizationPortalPath("/coaches")
  redirect(destination ?? "/dashboard")
}
