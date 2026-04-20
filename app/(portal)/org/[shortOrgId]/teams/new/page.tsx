import { redirect } from "next/navigation"

export default function OrganizationTeamsNewPage({
  params,
}: {
  params: { shortOrgId: string }
}) {
  redirect(`/org/${params.shortOrgId}/teams`)
}
