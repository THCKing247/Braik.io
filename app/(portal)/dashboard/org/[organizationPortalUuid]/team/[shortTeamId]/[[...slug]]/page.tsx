import { redirect } from "next/navigation"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveTeamIdFromOrganizationShortId } from "@/lib/navigation/organization-routes"

type Params = {
  organizationPortalUuid: string
  shortTeamId: string
  slug?: string[]
}

export default async function CanonicalTeamDashboardAliasPage({ params }: { params: Params }) {
  const teamId = await resolveTeamIdFromOrganizationShortId(
    getSupabaseServer(),
    params.organizationPortalUuid,
    params.shortTeamId
  )
  if (!teamId) {
    redirect("/dashboard")
  }
  const rest = params.slug?.length ? `/${params.slug.join("/")}` : ""
  const legacyPath = rest ? `/dashboard${rest}` : "/dashboard"
  redirect(`${legacyPath}?teamId=${encodeURIComponent(teamId)}`)
}
