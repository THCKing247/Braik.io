import { redirect } from "next/navigation"

export default function OrganizationTeamsNewPage({
  params,
}: {
  params: { organizationPortalUuid: string }
}) {
  redirect(`/org/${params.organizationPortalUuid}/teams`)
}
