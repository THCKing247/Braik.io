import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { AdTeamsPageClient } from "@/components/portal/ad/ad-teams-page-client"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"

export const dynamic = "force-dynamic"

export default async function AdTeamsPage() {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
  let schoolId: string | null = null
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", session.user.id)
    .maybeSingle()
  schoolId = profile?.school_id ?? null

  const teams: TeamRow[] = []

  if (schoolId) {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, sport, roster_size, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })

    if (teamsData?.length) {
      const teamIds = teamsData.map((t) => t.id)
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, team_id")
        .in("team_id", teamIds)
        .ilike("role", "head_coach")

      const coachUserIdByTeam = new Map<string, string>()
      coachProfiles?.forEach((p) => {
        coachUserIdByTeam.set(p.team_id, p.id)
      })
      teamsData.forEach((t) => {
        const createdBy = (t as { created_by?: string }).created_by
        if (createdBy && !coachUserIdByTeam.has(t.id)) {
          coachUserIdByTeam.set(t.id, createdBy)
        }
      })
      const coachUserIds = [...new Set(coachUserIdByTeam.values())]
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .in("id", coachUserIds)
      const headCoachByTeam = new Map<string, string>()
      coachUserIdByTeam.forEach((userId, teamId) => {
        const u = users?.find((u) => u.id === userId)
        headCoachByTeam.set(teamId, u?.name?.trim() ?? "")
      })

      const now = new Date().toISOString()
      const { data: pendingInvites } = await supabase
        .from("invites")
        .select("team_id")
        .in("team_id", teamIds)
        .is("accepted_at", null)
        .gt("expires_at", now)

      const pendingTeamIds = new Set((pendingInvites ?? []).map((i) => i.team_id))

      teamsData.forEach((t) => {
        const headCoachName = headCoachByTeam.get(t.id) ?? null
        const invitePending = pendingTeamIds.has(t.id)
        teams.push({
          id: t.id,
          name: t.name ?? "",
          sport: t.sport ?? null,
          rosterSize: (t as { roster_size?: number }).roster_size ?? null,
          createdAt: t.created_at ?? new Date().toISOString(),
          headCoachName,
          invitePending,
        })
      })
    }
  }

  return <AdTeamsPageClient teams={teams} />
}
