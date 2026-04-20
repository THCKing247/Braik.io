import { redirect } from "next/navigation"
import { resolveCurrentUserOrganizationPortalPath } from "@/lib/navigation/organization-portal-redirect"

export default async function AdSettingsPage() {
  const destination = await resolveCurrentUserOrganizationPortalPath("/settings")
  redirect(destination ?? "/dashboard")
}
