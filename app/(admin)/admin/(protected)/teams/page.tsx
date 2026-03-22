import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { OperatorTeams } from "@/components/admin/operator-teams"
import { isAssistantCoachRole, isHeadCoachRole, pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

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
      const teamIdList = (rows ?? []).map((t) => t.id)
      const { data: staffRows } =
        teamIdList.length > 0
          ? await supabase
              .from("team_members")
              .select("team_id, user_id, role, is_primary")
              .in("team_id", teamIdList)
              .eq("active", true)
          : { data: [] as Record<string, unknown>[] }

      const staffByTeam = new Map<string, TeamMemberStaffRow[]>()
      for (const row of staffRows ?? []) {
        const tid = row.team_id as string
        const list = staffByTeam.get(tid) ?? []
        list.push({
          user_id: row.user_id as string,
          role: row.role as string,
          is_primary: row.is_primary as boolean | null | undefined,
        })
        staffByTeam.set(tid, list)
      }

      const headCoachIds = new Set<string>()
      for (const tid of teamIdList) {
        const uid = pickHeadCoachUserId(staffByTeam.get(tid) ?? [])
        if (uid) headCoachIds.add(uid)
      }
      const { data: hcUsers } =
        headCoachIds.size > 0
          ? await supabase.from("users").select("id, name").in("id", [...headCoachIds])
          : { data: [] as { id: string; name: string | null }[] }
      const hcNameById = new Map((hcUsers ?? []).map((u) => [u.id, u.name?.trim() || null]))

      const result = (rows ?? []).map((t) => {
        const staff = staffByTeam.get(t.id) ?? []
        const hcUid = pickHeadCoachUserId(staff)
        const headCoachName =
          hcUid && (hcNameById.get(hcUid) ?? "")?.length
            ? (hcNameById.get(hcUid) as string)
            : null
        const coachStaffCount = staff.filter(
          (m) => isHeadCoachRole(m.role) || isAssistantCoachRole(m.role)
        ).length
        return {
          id: t.id,
          name: t.name,
          planTier: (t as { plan_tier?: string }).plan_tier ?? null,
          subscriptionStatus: (t as { subscription_status?: string }).subscription_status ?? "active",
          teamStatus: (t as { team_status?: string }).team_status ?? "active",
          organization: { name: (t as { org?: string }).org ?? t.name ?? "" },
          players: [] as Array<{ id: string }>,
          headCoachName,
          coachStaffCount,
        }
      })
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
      headCoachName: string | null
      coachStaffCount: number
    }>
  )

  return <OperatorTeams teams={teams} filterUserId={filterUserId} />
}
