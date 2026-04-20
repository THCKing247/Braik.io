import { OperatorTeams } from "@/components/admin/operator-teams"
import { loadAdminTeamsGrouped } from "@/lib/admin/load-admin-teams-grouped"

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; userId?: string }> | { q?: string; userId?: string }
}) {
  const sp = searchParams instanceof Promise ? await searchParams : searchParams
  const query = sp?.q?.trim() || ""
  const filterUserId = sp?.userId?.trim() || null
  const { groups, organizationDirectory, filterUserId: fid } = await loadAdminTeamsGrouped({ query, filterUserId })
  return (
    <OperatorTeams groups={groups} organizationDirectory={organizationDirectory} filterUserId={fid} />
  )
}
