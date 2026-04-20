import { redirect } from "next/navigation"

export default function OrganizationProgramRedirectPage({
  params,
}: {
  params: { shortOrgId: string }
}) {
  redirect(`/org/${params.shortOrgId}/coaches`)
}
