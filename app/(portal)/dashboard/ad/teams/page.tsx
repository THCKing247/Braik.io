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
      const { data: members } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds)
        .eq("role", "HEAD_COACH")
        .eq("active", true)

      const userIds = [...new Set((members ?? []).map((m) => m.user_id))]
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .in("id", userIds)

      const headCoachByTeam = new Map<string, string>()
      members?.forEach((m) => {
        const u = users?.find((u) => u.id === m.user_id)
        const name = u?.name?.trim() || null
        if (name) headCoachByTeam.set(m.team_id, name)
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
