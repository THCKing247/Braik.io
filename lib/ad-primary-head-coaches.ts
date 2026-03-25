import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdPortalAccess } from "@/lib/ad-portal-access"
import {
  fetchAdVisibleTeams,
  fetchAdVisibleTeamsForAccess,
  type AthleticDirectorScope,
} from "@/lib/ad-team-scope"

/** Primary head coach rows for AD-visible teams — from `team_members` only (active, primary, head_coach). */
export type AdPrimaryHeadCoachListItem = {
  teamId: string
  teamName: string
  userId: string
  fullName: string | null
  email: string | null
}

export type AdPrimaryHeadCoachesResult = {
  coaches: AdPrimaryHeadCoachListItem[]
  visibleTeamIds: string[]
  visibleTeamCount: number
  /** Rows in `team_members` matching active + primary + head_coach. */
  teamMembersHeadCoachRowCount: number
  distinctCoachUserCount: number
  /** Same as coaches.length — resolved primary head coach rows. */
  finalCoachesCount: number
  scope: AthleticDirectorScope
  orFilter: string | null
  /** Set when `fetchAdPortalVisibleTeams` fails (same query as Teams tab). */
  teamsQueryError: string | null
}

export type AdVisibleTeamMinimal = { id: string; name: string | null }

/**
 * Primary head coaches for AD-visible teams: `team_members` where
 * role = head_coach, active = true, is_primary = true. Profiles supply full_name and email.
 * Does not use teams.head_coach_user_id, created_by, or profile.role.
 */
export async function fetchAdPrimaryHeadCoachesForVisibleTeams(
  supabase: SupabaseClient,
  args: {
    teamRows: AdVisibleTeamMinimal[]
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
        primaryHeadCoachRowsFound: 0,
        finalCoachesCount: 0,
        distinctCoachUserCount: 0,
        orFilter,
      })
    )
    return {
      coaches: [],
      visibleTeamIds: [],
      visibleTeamCount: 0,
      teamMembersHeadCoachRowCount: 0,
      distinctCoachUserCount: 0,
      finalCoachesCount: 0,
      scope,
      orFilter,
      teamsQueryError: null,
    }
  }

  const { data: memberRows, error: tmErr } = await supabase
    .from("team_members")
    .select("team_id, user_id, role, is_primary")
    .in("team_id", visibleTeamIds)
    .eq("active", true)
    .eq("is_primary", true)
    .eq("role", "head_coach")

  const teamMembersHeadCoachRowCount = memberRows?.length ?? 0

  const resolved = (memberRows ?? []) as {
    team_id: string
    user_id: string
    role: string
    is_primary?: boolean | null
  }[]

  const userIds = [...new Set(resolved.map((r) => r.user_id))]
  const profileByUserId = new Map<string, { full_name: string | null; email: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    for (const p of profiles ?? []) {
      const row = p as { id: string; full_name: string | null; email: string | null }
      profileByUserId.set(row.id, { full_name: row.full_name, email: row.email })
    }
  }

  const coaches: AdPrimaryHeadCoachListItem[] = resolved.map((r) => {
    const prof = profileByUserId.get(r.user_id)
    return {
      teamId: r.team_id,
      teamName: teamNameById.get(r.team_id) ?? "—",
      userId: r.user_id,
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
      primaryHeadCoachRowsFound: teamMembersHeadCoachRowCount,
      resolvedHeadCoachAssignments: finalCoachesCount,
      distinctCoachUserCount,
      finalCoachesCount,
      orFilter,
      teamMembersQueryError: tmErr?.message ?? null,
    })
  )

  return {
    coaches,
    visibleTeamIds,
    visibleTeamCount,
    teamMembersHeadCoachRowCount,
    distinctCoachUserCount,
    finalCoachesCount,
    scope,
    orFilter,
    teamsQueryError: null,
  }
}

/**
 * Loads primary head coaches for AD scope (same visible teams as Teams tab via `fetchAdPortalVisibleTeams`).
 * Profiles supply display fields only (full_name, email).
 */
export async function fetchAdPrimaryHeadCoaches(
  supabase: SupabaseClient,
  sessionUserId: string,
  sessionRole: string | null,
  portalAccess?: AdPortalAccess | null
): Promise<AdPrimaryHeadCoachesResult> {
  const { scope, orFilter, teams: teamRows, error: teamsErr } =
    portalAccess != null
      ? await fetchAdVisibleTeamsForAccess(supabase, sessionUserId, portalAccess)
      : await fetchAdVisibleTeams(supabase, sessionUserId)

  if (!orFilter) {
    console.info(
      "[ad-coaches]",
      JSON.stringify({
        label: "fetchAdPrimaryHeadCoaches",
        userId: sessionUserId,
        sessionRole,
        visibleTeamIds: [],
        visibleTeamCount: 0,
        primaryHeadCoachRowsFound: 0,
        finalCoachesCount: 0,
        distinctCoachUserCount: 0,
        orFilter: null,
        queryError: "no_or_filter",
      })
    )
    return {
      coaches: [],
      visibleTeamIds: [],
      visibleTeamCount: 0,
      teamMembersHeadCoachRowCount: 0,
      distinctCoachUserCount: 0,
      finalCoachesCount: 0,
      scope,
      orFilter: null,
      teamsQueryError: null,
    }
  }

  if (teamsErr) {
    console.info(
      "[ad-coaches]",
      JSON.stringify({
        label: "fetchAdPrimaryHeadCoaches",
        userId: sessionUserId,
        sessionRole,
        teamsQueryError: teamsErr,
        visibleTeamIds: [],
        orFilter,
      })
    )
    return {
      coaches: [],
      visibleTeamIds: [],
      visibleTeamCount: 0,
      teamMembersHeadCoachRowCount: 0,
      distinctCoachUserCount: 0,
      finalCoachesCount: 0,
      scope,
      orFilter,
      teamsQueryError: teamsErr,
    }
  }

  const normalized: AdVisibleTeamMinimal[] = (teamRows ?? []).map((t) => ({
    id: t.id as string,
    name: t.name ?? null,
  }))

  const inner = await fetchAdPrimaryHeadCoachesForVisibleTeams(supabase, {
    teamRows: normalized,
    scope,
    orFilter,
    sessionUserId,
    sessionRole,
  })
  return { ...inner, teamsQueryError: null }
}
