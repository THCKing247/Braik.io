import { redirect } from "next/navigation"
import { AdTeamsPageLoader } from "@/components/portal/ad/ad-teams-page-loader"
import { loadAdTeamsTableForRequest } from "@/lib/ad/load-ad-teams-table-for-request"
import { buildOrganizationPortalPath } from "@/lib/navigation/organization-routes"

export default async function OrganizationTeamsPage({ params }: { params: { shortOrgId: string } }) {
  const result = await loadAdTeamsTableForRequest()
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      const callback = buildOrganizationPortalPath(params.shortOrgId, "/teams")
      redirect(`/login?callbackUrl=${encodeURIComponent(callback)}`)
    }
    if (result.kind === "forbidden") {
      redirect("/dashboard")
    }
    return (
      <div className="p-8">
        <p className="text-[#212529]">Could not load teams.</p>
      </div>
    )
  }
  return <AdTeamsPageLoader initialTeams={result.teams} />
}
