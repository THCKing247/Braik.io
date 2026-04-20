import { redirect } from "next/navigation"

export default function OrganizationProgramRedirectPage({
  params,
}: {
  params: { organizationPortalUuid: string }
}) {
  redirect(`/org/${params.organizationPortalUuid}/coaches`)
}
