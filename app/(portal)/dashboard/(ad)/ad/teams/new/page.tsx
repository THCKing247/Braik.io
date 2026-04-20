import { redirect } from "next/navigation"
import { resolveCurrentUserOrganizationPortalPath } from "@/lib/navigation/organization-portal-redirect"

/** Manual AD team creation removed (Phase 4); teams come from signup/provisioning. */
export default async function AdTeamsNewPage() {
  const destination = await resolveCurrentUserOrganizationPortalPath("/teams")
  redirect(destination ?? "/dashboard")
}
