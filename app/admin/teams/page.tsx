import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin-db-safe"
import { OperatorTeams } from "@/components/admin/operator-teams"

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams?: { q?: string }
}) {
  const query = searchParams?.q?.trim() || ""
  const supabase = getSupabaseServer()

  const teams = await safeAdminDbQuery(
    async () => {
      let q = supabase.from("teams").select("id, name, plan_tier, subscription_status, team_status, org").order("created_at", { ascending: false }).limit(100)
      if (query) {
        q = q.or(`name.ilike.%${query}%,org.ilike.%${query}%`)
      }
      const { data: rows } = await q
      const result = await Promise.all(
        (rows ?? []).map(async (t) => {
const { data: memberships } = await supabase.from("team_members").select("user_id, role").eq("team_id", t.id)
          const coachMemberships = (memberships ?? []).filter((m) => ["HEAD_COACH", "ASSISTANT_COACH", "head_coach", "assistant_coach"].includes(String((m as { role?: string }).role ?? "")))
          return {
            id: t.id,
            name: t.name,
            planTier: (t as { plan_tier?: string }).plan_tier ?? null,
            subscriptionStatus: (t as { subscription_status?: string }).subscription_status ?? "active",
            teamStatus: (t as { team_status?: string }).team_status ?? "active",
            organization: { name: (t as { org?: string }).org ?? t.name ?? "" },
            players: [] as Array<{ id: string }>,
            memberships: (memberships ?? []).map((m) => ({ userId: (m as { user_id: string }).user_id })),
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

  return <OperatorTeams teams={teams} />
}
