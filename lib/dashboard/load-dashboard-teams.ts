import { cache } from "react"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type DashboardShellTeam = {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
  primaryColor?: string
  secondaryColor?: string
  teamStatus?: string
  subscriptionPaid?: boolean
  amountPaid?: number
  players?: unknown[]
}

/**
 * Minimal team list for the dashboard shell (nav, switcher, portal context).
 * Cached per request for the same user/impersonation tuple so repeated access is free.
 * Skips a redundant profiles row when not impersonating — session.user.teamId already
 * comes from profiles in buildSessionUser().
 */
export const loadDashboardShellTeams = cache(
  async (
    effectiveUserId: string,
    sessionUserId: string,
    sessionTeamId: string | undefined,
    isImpersonating: boolean
  ): Promise<DashboardShellTeam[]> => {
    const supabase = getSupabaseServer()

    const [membersRes, profileRes] = await Promise.all([
      supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", effectiveUserId)
        .eq("active", true),
      isImpersonating
        ? supabase.from("profiles").select("team_id").eq("id", effectiveUserId).maybeSingle()
        : Promise.resolve({ data: null as { team_id?: string | null } | null }),
    ])

    const membershipRows = membersRes.data
    const profileTeamId = isImpersonating ? profileRes.data?.team_id : undefined

    let teamIds: string[] = [...new Set((membershipRows ?? []).map((r) => r.team_id).filter(Boolean))]

    if (profileTeamId && !teamIds.includes(profileTeamId)) {
      teamIds = [...teamIds, profileTeamId]
    }

    if (!isImpersonating && sessionTeamId && !teamIds.includes(sessionTeamId)) {
      teamIds = [...teamIds, sessionTeamId]
    }

    if (teamIds.length === 0) {
      const [hcRes, createdRes] = await Promise.all([
        supabase.from("teams").select("id").eq("head_coach_user_id", effectiveUserId),
        supabase.from("teams").select("id").eq("created_by", effectiveUserId),
      ])
      const hcTeams = hcRes.data
      const createdTeams = createdRes.data
      if (hcTeams?.length) {
        teamIds = hcTeams.map((t) => t.id)
      } else if (createdTeams?.length) {
        teamIds = createdTeams.map((t) => t.id)
      }
    }

    if (teamIds.length === 0 && sessionTeamId && effectiveUserId === sessionUserId) {
      teamIds = [sessionTeamId]
    }

    if (teamIds.length === 0) return []

    const { data: teamsData } = await supabase.from("teams").select("id, name").in("id", teamIds)

    return (teamsData ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      organization: { name: t.name ?? "" },
      sport: "football",
      seasonName: "",
      primaryColor: "#1e3a5f",
      secondaryColor: "#FFFFFF",
      teamStatus: "active",
      subscriptionPaid: false,
      amountPaid: 0,
      players: [],
    }))
  }
)
