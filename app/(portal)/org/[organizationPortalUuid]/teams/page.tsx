import { redirect } from "next/navigation"
import { AdTeamsPageLoader } from "@/components/portal/ad/ad-teams-page-loader"
import { loadAdTeamsTableForRequest } from "@/lib/ad/load-ad-teams-table-for-request"

export default async function OrganizationTeamsPage() {
  const result = await loadAdTeamsTableForRequest()
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      redirect("/login?callbackUrl=/dashboard/ad/teams")
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
