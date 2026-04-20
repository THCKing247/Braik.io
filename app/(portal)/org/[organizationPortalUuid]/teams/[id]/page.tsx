import { AdTeamEditPageClient } from "@/components/portal/ad/ad-team-edit-page-client"

export default function OrganizationTeamEditPage({ params }: { params: { id: string } }) {
  return <AdTeamEditPageClient teamId={params.id} />
}
