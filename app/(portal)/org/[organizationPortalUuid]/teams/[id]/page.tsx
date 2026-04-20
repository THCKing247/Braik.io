import { redirect } from "next/navigation"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveShortOrgIdForOrganizationPortalUuid } from "@/lib/navigation/organization-routes"

export default async function OrganizationTeamEditPage({
  params,
}: {
  params: { organizationPortalUuid: string; id: string }
}) {
  const shortOrgId = await resolveShortOrgIdForOrganizationPortalUuid(
    getSupabaseServer(),
    params.organizationPortalUuid
  )
  redirect(shortOrgId ? `/org/${shortOrgId}/teams/${params.id}` : "/dashboard")
}
