import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdPortalAccess } from "@/lib/ad-portal-access"

/**
 * Resolves which teams an Athletic Director should see:
 * - Teams at their school (school_id) or department (athletic_department_id), including AD-created teams.
 * - Teams in programs linked to their organization (programs.organization_id → org for this AD).
 *
 * Linking a head coach program only sets programs.organization_id; it does not require teams.school_id
 * to match the AD's school, so the portal must include program_id scope.
 */
export type AthleticDirectorScope = {
  userId: string
  profileSchoolId: string | null
  profileRole: string | null
  athleticDepartmentId: string | null
  organizationIds: string[]
  linkedProgramIds: string[]
}

export async function resolveAthleticDirectorScope(
  supabase: SupabaseClient,
  userId: string
): Promise<AthleticDirectorScope> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, role")
    .eq("id", userId)
    .maybeSingle()

  const { data: dept } = await supabase
    .from("athletic_departments")
    .select("id")
    .eq("athletic_director_user_id", userId)
    .maybeSingle()

  const organizationIds: string[] = []
  if (dept?.id) {
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id")
      .eq("athletic_department_id", dept.id)
    for (const o of orgs ?? []) {
      if (o?.id) organizationIds.push(o.id)
    }
  }

  const linkedProgramIds: string[] = []
  if (organizationIds.length > 0) {
    const { data: programs } = await supabase
      .from("programs")
      .select("id")
      .in("organization_id", organizationIds)
    for (const p of programs ?? []) {
      if (p?.id) linkedProgramIds.push(p.id)
    }
  }

  return {
    userId,
    profileSchoolId: profile?.school_id ?? null,
    profileRole: profile?.role ?? null,
    athleticDepartmentId: dept?.id ?? null,
    organizationIds,
    linkedProgramIds,
  }
}

/** PostgREST `or` filter for teams visible to this AD (use with .or()). */
export function buildAdTeamsOrFilter(scope: AthleticDirectorScope): string | null {
  const parts: string[] = []
  if (scope.profileSchoolId) {
    parts.push(`school_id.eq.${scope.profileSchoolId}`)
  }
  if (scope.athleticDepartmentId) {
    parts.push(`athletic_department_id.eq.${scope.athleticDepartmentId}`)
  }
  if (scope.linkedProgramIds.length > 0) {
    parts.push(`program_id.in.(${scope.linkedProgramIds.join(",")})`)
  }
  if (parts.length === 0) return null
  return parts.join(",")
}

export function teamRowVisibleToAdScope(
  team: {
    school_id?: string | null
    athletic_department_id?: string | null
    program_id?: string | null
  },
  scope: AthleticDirectorScope
): boolean {
  if (scope.profileSchoolId && team.school_id === scope.profileSchoolId) return true
  if (scope.athleticDepartmentId && team.athletic_department_id === scope.athleticDepartmentId) return true
  if (team.program_id && scope.linkedProgramIds.includes(team.program_id)) return true
  return false
}

export function logAdTeamVisibility(
  label: string,
  payload: {
    scope: AthleticDirectorScope
    sessionRole?: string | null
    teamCount: number
    teamIds: string[]
    filter: string | null
    queryError?: string | null
  }
): void {
  const { scope, sessionRole, teamCount, teamIds, filter, queryError } = payload
  console.info(
    `[ad-team-visibility] ${label}`,
    JSON.stringify({
      userId: scope.userId,
      sessionRole: sessionRole ?? null,
      profileRole: scope.profileRole,
      profileSchoolId: scope.profileSchoolId,
      athleticDepartmentId: scope.athleticDepartmentId,
      resolvedOrganizationIds: scope.organizationIds,
      linkedProgramIds: scope.linkedProgramIds,
      teamsOrFilter: filter,
      returnedTeamCount: teamCount,
      returnedTeamIds: teamIds,
      supabaseClient: "service_role",
      rlsBypassedForThisRequest: true,
      queryError: queryError ?? null,
    })
  )
}

/** Same row shape and ordering as `/dashboard/ad/teams` — single source for AD-visible teams. */
export type AdVisibleTeamRow = {
  id: string
  name: string | null
  sport: string | null
  roster_size: number | null
  created_at: string
  school_id: string | null
  program_id: string | null
  athletic_department_id: string | null
}

export async function fetchAdVisibleTeams(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  scope: AthleticDirectorScope
  orFilter: string | null
  teams: AdVisibleTeamRow[]
  error: string | null
}> {
  const scope = await resolveAthleticDirectorScope(supabase, userId)
  const orFilter = buildAdTeamsOrFilter(scope)
  if (!orFilter) {
    return { scope, orFilter: null, teams: [], error: null }
  }
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, sport, roster_size, created_at, school_id, program_id, athletic_department_id")
    .or(orFilter)
    .order("created_at", { ascending: false })
  return {
    scope,
    orFilter,
    teams: (data ?? []) as AdVisibleTeamRow[],
    error: error?.message ?? null,
  }
}

/** Use with `getAdPortalAccessForUser` so varsity HCs see correct teams inside the AD portal shell. */
export async function fetchAdVisibleTeamsForAccess(
  supabase: SupabaseClient,
  userId: string,
  access: AdPortalAccess
): Promise<{
  scope: AthleticDirectorScope
  orFilter: string | null
  teams: AdVisibleTeamRow[]
  error: string | null
}> {
  if (access.mode === "none") {
    const scope = await resolveAthleticDirectorScope(supabase, userId)
    return { scope, orFilter: null, teams: [], error: null }
  }

  if (access.teamQuery === "program_ids") {
    if (access.footballProgramIds.length === 0) {
      const scope = await resolveAthleticDirectorScope(supabase, userId)
      return { scope, orFilter: null, teams: [], error: null }
    }
    const orFilter = `program_id.in.(${access.footballProgramIds.join(",")})`
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, sport, roster_size, created_at, school_id, program_id, athletic_department_id")
      .or(orFilter)
      .order("created_at", { ascending: false })
    const scope = await resolveAthleticDirectorScope(supabase, userId)
    const linkedScope: AthleticDirectorScope = {
      ...scope,
      linkedProgramIds: access.footballProgramIds,
      profileRole: scope.profileRole ?? "head_coach",
    }
    return {
      scope: linkedScope,
      orFilter,
      teams: (data ?? []) as AdVisibleTeamRow[],
      error: error?.message ?? null,
    }
  }

  return fetchAdVisibleTeams(supabase, userId)
}

export function logAdDashboardMetrics(
  label: string,
  payload: {
    scope: AthleticDirectorScope
    sessionRole: string | null
    visibleTeamIds: string[]
    teamCount: number
    headCoachMembershipCount: number
    assistantCoachMembershipCount: number
    totalCoachMemberships: number
    athleteCount: number
    emptyStateTriggered: boolean
    orFilter: string | null
    teamsQueryError?: string | null
    playersCountError?: string | null
  }
): void {
  console.info(
    `[ad-dashboard-metrics] ${label}`,
    JSON.stringify({
      userId: payload.scope.userId,
      sessionRole: payload.sessionRole,
      resolvedAdScope: {
        profileSchoolId: payload.scope.profileSchoolId,
        athleticDepartmentId: payload.scope.athleticDepartmentId,
        organizationIds: payload.scope.organizationIds,
        linkedProgramIds: payload.scope.linkedProgramIds,
      },
      visibleTeamIds: payload.visibleTeamIds,
      teamCount: payload.teamCount,
      headCoachMembershipCount: payload.headCoachMembershipCount,
      assistantCoachMembershipCount: payload.assistantCoachMembershipCount,
      totalCoachMemberships: payload.totalCoachMemberships,
      athleteCount: payload.athleteCount,
      emptyStateTriggered: payload.emptyStateTriggered,
      teamsOrFilter: payload.orFilter,
      teamsQueryError: payload.teamsQueryError ?? null,
      playersCountError: payload.playersCountError ?? null,
    })
  )
}
