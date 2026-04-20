import { redirect } from "next/navigation"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveShortOrgIdForOrganizationPortalUuid } from "@/lib/navigation/organization-routes"

export default async function OrganizationCoachesPage({
  params,
}: {
  params: { organizationPortalUuid: string }
}) {
  const shortOrgId = await resolveShortOrgIdForOrganizationPortalUuid(
    getSupabaseServer(),
    params.organizationPortalUuid
  )
  redirect(shortOrgId ? `/org/${shortOrgId}/coaches` : "/dashboard")
}
