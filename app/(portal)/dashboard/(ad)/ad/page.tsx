import { redirect } from "next/navigation"
import { resolveCurrentUserOrganizationPortalPath } from "@/lib/navigation/organization-portal-redirect"

export default async function AthleticDirectorOverviewPage() {
  const destination = await resolveCurrentUserOrganizationPortalPath()
  redirect(destination ?? "/dashboard")
}
