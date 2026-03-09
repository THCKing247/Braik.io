import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { OperatorTeams } from "@/components/admin/operator-teams"

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams?: { q?: string; userId?: string }
}) {
  const query = searchParams?.q?.trim() || ""
  const filterUserId = searchParams?.userId?.trim() || null
  const supabase = getSupabaseServer()

  const teams = await safeAdminDbQuery(
    async () => {
      let teamIds: string[] | null = null
      if (filterUserId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("team_id")
          .eq("id", filterUserId)
          .maybeSingle()
        teamIds = profile?.team_id ? [profile.team_id] : []
        if (teamIds.length === 0) return []
      }

      let q = supabase
        .from("teams")
        .select("id, name, plan_tier, subscription_status, team_status, org")
        .order("created_at", { ascending: false })
        .limit(100)
      if (teamIds) q = q.in("id", teamIds)
      if (query) {
        q = q.or(`name.ilike.%${query}%,org.ilike.%${query}%`)
      }
      const { data: rows } = await q
      const result = await Promise.all(
        (rows ?? []).map(async (t) => {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("team_id", t.id)
          return {
            id: t.id,
            name: t.name,
            planTier: (t as { plan_tier?: string }).plan_tier ?? null,
            subscriptionStatus: (t as { subscription_status?: string }).subscription_status ?? "active",
            teamStatus: (t as { team_status?: string }).team_status ?? "active",
            organization: { name: (t as { org?: string }).org ?? t.name ?? "" },
            players: [] as Array<{ id: string }>,
            memberships: (profiles ?? []).map((p) => ({ userId: p.id })),
          }
        })
      )
      return result
    },
    [] as Array<{
      id: string
      name: string
      planTier: string | null
      subscriptionStatus: string
      teamStatus: string
      organization: { name: string }
      players: Array<{ id: string }>
      memberships: Array<{ userId: string }>
    }>
  )

  return <OperatorTeams teams={teams} filterUserId={filterUserId} />
}
