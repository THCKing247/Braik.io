import { AdTeamEditPageClient } from "@/components/portal/ad/ad-team-edit-page-client"

export default function AdTeamEditPage({ params }: { params: { id: string } }) {
  return <AdTeamEditPageClient teamId={params.id} />
}
