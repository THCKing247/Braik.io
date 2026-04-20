import { redirect } from "next/navigation"
import { resolveCurrentUserOrganizationPortalPath } from "@/lib/navigation/organization-portal-redirect"

export default async function AdTeamEditPage({ params }: { params: { id: string } }) {
  const destination = await resolveCurrentUserOrganizationPortalPath(`/teams/${params.id}`)
  redirect(destination ?? "/dashboard")
}
