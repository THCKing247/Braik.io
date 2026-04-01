import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { fetchSuperAdminTeamsList } from "@/lib/admin/admin-teams-list"
import { OperatorTeams } from "@/components/admin/operator-teams"

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams?: { q?: string; userId?: string }
}) {
  const q = searchParams?.q?.trim() ?? ""
  const filterUserId = searchParams?.userId?.trim() || null
  const supabase = getSupabaseServer()

  const { teams, error } = await fetchSuperAdminTeamsList(supabase, {
    q,
    filterUserId,
  })

  return (
    <OperatorTeams teams={teams} filterUserId={filterUserId} serverSearchQuery={q || undefined} fetchError={error} />
  )
}
