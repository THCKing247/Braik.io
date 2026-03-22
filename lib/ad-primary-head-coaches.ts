import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildAdTeamsOrFilter,
  resolveAthleticDirectorScope,
  type AthleticDirectorScope,
} from "@/lib/ad-team-scope"
import { pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

/** Primary head coach rows for AD-visible teams — resolved from team_members and/or teams.head_coach_user_id. */
export type AdPrimaryHeadCoachListItem = {
  teamId: string
  teamName: string
  userId: string
  fullName: string | null
  email: string | null
}

export type AdPrimaryHeadCoachesResult = {
  coaches: AdPrimaryHeadCoachListItem[]
  visibleTeamCount: number
  /** Rows returned from team_members (active head_coach). */
  teamMembersHeadCoachRowCount: number
  distinctCoachUserCount: number
  /** Same as coaches.length — teams with a resolved head coach. */
  finalCoachesCount: number
  scope: AthleticDirectorScope
  orFilter: string | null
}

/** AD-visible team row — include denormalized head coach (see teams.head_coach_user_id). */
export type VisibleAdTeamRow = { id: string; name: string | null; head_coach_user_id: string | null }

/**
 * Resolves head coach per team: prefer `teams.head_coach_user_id`, else `pickHeadCoachUserId` on active
 * `team_members` head_coach rows (same idea as AD Teams page — does not require is_primary).
 */
export async function fetchAdPrimaryHeadCoachesForVisibleTeams(
  supabase: SupabaseClient,
  args: {
    teamRows: VisibleAdTeamRow[]
    scope: AthleticDirectorScope
    orFilter: string
    sessionUserId: string
    sessionRole: string | null
  }
): Promise<AdPrimaryHeadCoachesResult> {
  const { teamRows, scope, orFilter, sessionUserId, sessionRole } = args
  const visibleTeamIds = teamRows.map((t) => t.id)
  const visibleTeamCount = teamRows.length
  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name ?? ""]))

  if (visibleTeamIds.length === 0) {
    console.info(
      "[ad-coaches]",
      JSON.stringify({
        label: "fetchAdPrimaryHeadCoachesForVisibleTeams",
        userId: sessionUserId,
        sessionRole,
        visibleTeamIds: [],
        visibleTeamCount: 0,
        teamMembersHeadCoachRowCount: 0,
        finalCoachesCount: 0,
        distinctCoachUserCount: 0,
        orFilter,
      })
    )
    return {
      coaches: [],
      visibleTeamCount: 0,
      teamMembersHeadCoachRowCount: 0,
      distinctCoachUserCount: 0,
      finalCoachesCount: 0,
      scope,
      orFilter,
    }
  }

  const { data: memberRows, error: tmErr } = await supabase
    .from("team_members")
    .select("team_id, user_id, role, is_primary")
    .in("team_id", visibleTeamIds)
    .eq("active", true)
    .ilike("role", "head_coach")

  const teamMembersHeadCoachRowCount = memberRows?.length ?? 0

  const byTeam = new Map<string, TeamMemberStaffRow[]>()
  for (const r of memberRows ?? []) {
    const row = r as {
      team_id: string
      user_id: string
      role: string
      is_primary?: boolean | null
    }
    const list = byTeam.get(row.team_id) ?? []
    list.push({
      user_id: row.user_id,
      role: row.role,
      is_primary: row.is_primary,
    })
    byTeam.set(row.team_id, list)
  }

  const resolved: { teamId: string; userId: string; source: "teams.head_coach_user_id" | "team_members" }[] = []
  for (const t of teamRows) {
    const fromTeam = t.head_coach_user_id?.trim() ? t.head_coach_user_id : null
    const fromMembers = pickHeadCoachUserId(byTeam.get(t.id) ?? [])
    const userId = fromTeam ?? fromMembers
    if (!userId) continue
    resolved.push({
      teamId: t.id,
      userId,
      source: fromTeam ? "teams.head_coach_user_id" : "team_members",
    })
  }

  const userIds = [...new Set(resolved.map((r) => r.userId))]
  const profileByUserId = new Map<string, { full_name: string | null; email: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    for (const p of profiles ?? []) {
      const row = p as { id: string; full_name: string | null; email: string | null }
      profileByUserId.set(row.id, { full_name: row.full_name, email: row.email })
    }
  }

  const coaches: AdPrimaryHeadCoachListItem[] = resolved.map((r) => {
    const prof = profileByUserId.get(r.userId)
    return {
      teamId: r.teamId,
      teamName: teamNameById.get(r.teamId) ?? "—",
      userId: r.userId,
      fullName: prof?.full_name ?? null,
      email: prof?.email ?? null,
    }
  })

  const distinctCoachUserCount = userIds.length
  const finalCoachesCount = coaches.length

  console.info(
    "[ad-coaches]",
    JSON.stringify({
      label: "fetchAdPrimaryHeadCoachesForVisibleTeams",
      userId: sessionUserId,
      sessionRole,
      visibleTeamIds,
      teamMembersHeadCoachRowCount,
      resolvedHeadCoachAssignments: finalCoachesCount,
      distinctCoachUserCount,
      finalCoachesCount,
      orFilter,
      teamMembersQueryError: tmErr?.message ?? null,
    })
  )

  return {
    coaches,
    visibleTeamCount,
    teamMembersHeadCoachRowCount,
    distinctCoachUserCount,
    finalCoachesCount,
    scope,
    orFilter,
  }
}

/**
 * Loads primary head coaches for AD scope (same team query as Teams page).
 * Profiles supply display fields only (full_name, email).
 */
export async function fetchAdPrimaryHeadCoaches(
  supabase: SupabaseClient,
  sessionUserId: string,
  sessionRole: string | null
): Promise<AdPrimaryHeadCoachesResult> {
  const scope = await resolveAthleticDirectorScope(supabase, sessionUserId)
  const orFilter = buildAdTeamsOrFilter(scope)

  if (!orFilter) {
    console.info(
      "[ad-coaches]",
      JSON.stringify({
        label: "fetchAdPrimaryHeadCoaches",
        userId: sessionUserId,
        sessionRole,
        visibleTeamIds: [],
        visibleTeamCount: 0,
        teamMembersHeadCoachRowCount: 0,
        finalCoachesCount: 0,
        distinctCoachUserCount: 0,
        orFilter: null,
        queryError: "no_or_filter",
      })
    )
    return {
      coaches: [],
      visibleTeamCount: 0,
      teamMembersHeadCoachRowCount: 0,
      distinctCoachUserCount: 0,
      finalCoachesCount: 0,
      scope,
      orFilter: null,
    }
  }

  const { data: teamRows, error: teamsErr } = await supabase
    .from("teams")
    .select("id, name, head_coach_user_id")
    .or(orFilter)

  if (teamsErr) {
    console.info(
      "[ad-coaches]",
      JSON.stringify({
        label: "fetchAdPrimaryHeadCoaches",
        userId: sessionUserId,
        sessionRole,
        teamsQueryError: teamsErr.message,
        visibleTeamIds: [],
        orFilter,
      })
    )
    return {
      coaches: [],
      visibleTeamCount: 0,
      teamMembersHeadCoachRowCount: 0,
      distinctCoachUserCount: 0,
      finalCoachesCount: 0,
      scope,
      orFilter,
    }
  }

  const normalized: VisibleAdTeamRow[] = (teamRows ?? []).map((t) => ({
    id: t.id as string,
    name: (t as { name?: string | null }).name ?? null,
    head_coach_user_id: (t as { head_coach_user_id?: string | null }).head_coach_user_id ?? null,
  }))

  return fetchAdPrimaryHeadCoachesForVisibleTeams(supabase, {
    teamRows: normalized,
    scope,
    orFilter,
    sessionUserId,
    sessionRole,
  })
}
