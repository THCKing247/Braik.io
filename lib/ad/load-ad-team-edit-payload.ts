import type { SupabaseClient } from "@supabase/supabase-js"
import { logAdTeamVisibility, resolveAdPortalTeamScope, teamRowVisibleToAdScope } from "@/lib/ad-team-scope"
import { canAccessAdPortalRoutes } from "@/lib/enforcement/football-ad-access"
import { assistantCoachUserIds, pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"
import { SPORT_OPTIONS } from "@/lib/pricing-sports"

export type AdTeamEditPayloadResult =
  | { kind: "redirect"; to: string }
  | {
      kind: "ok"
      teamId: string
      teamName: string
      initialName: string
      initialSport: string
      initialRosterSize: number | null
      initialTeamLevel: string | null
      initialGender: string | null
      initialHeadCoachEmail: string | null
      headCoachDisplay: string | null
      assistantNamesText: string
      seasonDisplay: string
    }

export async function loadAdTeamEditPayload(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  sessionRole: string | null | undefined
): Promise<AdTeamEditPayloadResult> {
  const { scope, orFilter: teamsOrFilter, footballAccess } = await resolveAdPortalTeamScope(supabase, userId)

  if (!canAccessAdPortalRoutes(footballAccess) || !teamsOrFilter) {
    logAdTeamVisibility("AdTeamEditPage", {
      scope,
      sessionRole: sessionRole ?? null,
      teamCount: 0,
      teamIds: [],
      filter: null,
      queryError: "no_scope",
    })
    return { kind: "redirect", to: "/dashboard/ad/teams" }
  }

  const { data: team } = await supabase
    .from("teams")
    .select(
      "id, name, sport, roster_size, season, notes, school_id, athletic_department_id, program_id, team_level, gender"
    )
    .eq("id", teamId)
    .maybeSingle()

  let programSport: string | null = null
  const pid = team ? (team as { program_id?: string | null }).program_id : null
  if (pid) {
    const { data: prog } = await supabase.from("programs").select("sport").eq("id", pid).maybeSingle()
    programSport = (prog?.sport as string) || null
  }

  if (!team || !teamRowVisibleToAdScope(team, scope)) {
    logAdTeamVisibility("AdTeamEditPage", {
      scope,
      sessionRole: sessionRole ?? null,
      teamCount: 0,
      teamIds: [],
      filter: `team_id.eq.${teamId}`,
      queryError: team ? "team_not_in_ad_scope" : "team_not_found",
    })
    return { kind: "redirect", to: "/dashboard/ad/teams" }
  }

  logAdTeamVisibility("AdTeamEditPage", {
    scope,
    sessionRole: sessionRole ?? null,
    teamCount: 1,
    teamIds: [team.id],
    filter: `team_id.eq.${teamId}`,
    queryError: null,
  })

  const { data: staffRows } = await supabase
    .from("team_members")
    .select("user_id, role, is_primary")
    .eq("team_id", team.id)
    .eq("active", true)

  const staff: TeamMemberStaffRow[] = (staffRows ?? []).map((r) => ({
    user_id: (r as { user_id: string }).user_id,
    role: (r as { role: string }).role,
    is_primary: (r as { is_primary?: boolean | null }).is_primary,
  }))

  const headCoachUserId = pickHeadCoachUserId(staff)
  const assistantIds = assistantCoachUserIds(staff)
  const nameIds = [...new Set([headCoachUserId, ...assistantIds].filter((id): id is string => Boolean(id)))]
  const { data: staffUsers } =
    nameIds.length > 0
      ? await supabase.from("users").select("id, name").in("id", nameIds)
      : { data: [] as { id: string; name: string | null }[] }
  const nameById = new Map((staffUsers ?? []).map((u) => [u.id, u.name?.trim() || null]))

  const rawHcName = headCoachUserId ? nameById.get(headCoachUserId) : null
  const headCoachDisplay = rawHcName && rawHcName.length > 0 ? rawHcName : null

  let headCoachEmail: string | null = null
  if (headCoachUserId) {
    const { data: hp } = await supabase.from("profiles").select("email").eq("id", headCoachUserId).maybeSingle()
    headCoachEmail = (hp?.email as string | null) ?? null
  }

  const assistantNames = assistantIds
    .map((id) => nameById.get(id))
    .filter((n): n is string => Boolean(n && n.length > 0))

  const rawSport =
    (team as { sport?: string | null }).sport?.trim() || programSport?.trim() || "football"
  const sportDisplay =
    SPORT_OPTIONS.find((o) => o.toLowerCase() === rawSport.toLowerCase()) ?? "Football"

  return {
    kind: "ok",
    teamId: team.id,
    teamName: (team as { name?: string | null }).name ?? "",
    initialName: (team as { name?: string | null }).name ?? "",
    initialSport: sportDisplay,
    initialRosterSize: (team as { roster_size?: number | null }).roster_size ?? null,
    initialTeamLevel: (team as { team_level?: string | null }).team_level ?? null,
    initialGender: (team as { gender?: string | null }).gender ?? null,
    initialHeadCoachEmail: headCoachEmail,
    headCoachDisplay,
    assistantNamesText: assistantNames.length > 0 ? assistantNames.join(", ") : "None listed",
    seasonDisplay: (team as { season?: string | null }).season?.trim() || "Not set",
  }
}
