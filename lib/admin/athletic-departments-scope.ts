import type { SupabaseClient } from "@supabase/supabase-js"
import { assistantCoachUserIds, isAssistantCoachRole, isHeadCoachRole, pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

export function resolveAthleticDepartmentIdForTeam(args: {
  teamAthleticDepartmentId: string | null | undefined
  organizationAthleticDepartmentId: string | null | undefined
}): string | null {
  return args.teamAthleticDepartmentId ?? args.organizationAthleticDepartmentId ?? null
}

/**
 * All team IDs managed under an athletic department (direct `teams.athletic_department_id`
 * or via program → organization).
 */
export async function collectTeamIdsForAthleticDepartment(
  supabase: SupabaseClient,
  athleticDepartmentId: string
): Promise<string[]> {
  const ids = new Set<string>()

  const { data: direct } = await supabase
    .from("teams")
    .select("id")
    .eq("athletic_department_id", athleticDepartmentId)
  for (const row of direct ?? []) {
    ids.add((row as { id: string }).id)
  }

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .eq("athletic_department_id", athleticDepartmentId)
  const orgIds = (orgs ?? []).map((o) => (o as { id: string }).id)
  if (orgIds.length === 0) {
    return [...ids]
  }

  const { data: programs } = await supabase.from("programs").select("id").in("organization_id", orgIds)
  const programIds = (programs ?? []).map((p) => (p as { id: string }).id)
  if (programIds.length === 0) {
    return [...ids]
  }

  const { data: viaProgram } = await supabase.from("teams").select("id").in("program_id", programIds)
  for (const row of viaProgram ?? []) {
    ids.add((row as { id: string }).id)
  }

  return [...ids]
}

export async function countActiveTeams(teamIds: string[], supabase: SupabaseClient): Promise<number> {
  if (teamIds.length === 0) return 0
  const { count, error } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .in("id", teamIds)
    .eq("team_status", "active")
  if (error) throw error
  return count ?? 0
}

export async function countAssistantCoachesOnTeams(
  supabase: SupabaseClient,
  teamIds: string[]
): Promise<number> {
  if (teamIds.length === 0) return 0
  const { data: rows, error } = await supabase
    .from("team_members")
    .select("user_id, role, active")
    .in("team_id", teamIds)
    .eq("active", true)
  if (error) throw error
  let n = 0
  for (const row of rows ?? []) {
    if (isAssistantCoachRole((row as { role?: string }).role)) n += 1
  }
  return n
}

export async function loadStaffRowsForTeams(
  supabase: SupabaseClient,
  teamIds: string[]
): Promise<Map<string, TeamMemberStaffRow[]>> {
  const map = new Map<string, TeamMemberStaffRow[]>()
  if (teamIds.length === 0) return map
  const { data: rows, error } = await supabase
    .from("team_members")
    .select("team_id, user_id, role, is_primary, active")
    .in("team_id", teamIds)
    .eq("active", true)
  if (error) throw error
  for (const row of rows ?? []) {
    const tid = (row as { team_id: string }).team_id
    const list = map.get(tid) ?? []
    list.push({
      user_id: (row as { user_id: string }).user_id,
      role: (row as { role?: string }).role,
      is_primary: (row as { is_primary?: boolean | null }).is_primary,
    })
    map.set(tid, list)
  }
  return map
}

export async function distinctUserCountForTeams(supabase: SupabaseClient, teamIds: string[]): Promise<number> {
  if (teamIds.length === 0) return 0
  const { data: rows, error } = await supabase
    .from("team_members")
    .select("user_id")
    .in("team_id", teamIds)
    .eq("active", true)
  if (error) throw error
  const u = new Set<string>()
  for (const row of rows ?? []) {
    const id = (row as { user_id?: string }).user_id
    if (id) u.add(id)
  }
  return u.size
}

/**
 * Users tied to this AD: athletic director, program members under orgs of this AD, and team members on scoped teams.
 */
export async function collectAssociatedUserIdsForAthleticDepartment(
  supabase: SupabaseClient,
  athleticDepartmentId: string,
  teamIds: string[]
): Promise<Set<string>> {
  const users = new Set<string>()

  const { data: adRow } = await supabase
    .from("athletic_departments")
    .select("athletic_director_user_id")
    .eq("id", athleticDepartmentId)
    .maybeSingle()
  const adUid = (adRow as { athletic_director_user_id?: string } | null)?.athletic_director_user_id
  if (adUid) users.add(adUid)

  if (teamIds.length > 0) {
    const { data: tm, error: e1 } = await supabase
      .from("team_members")
      .select("user_id")
      .in("team_id", teamIds)
      .eq("active", true)
    if (e1) throw e1
    for (const r of tm ?? []) {
      const id = (r as { user_id?: string }).user_id
      if (id) users.add(id)
    }
  }

  const { data: orgs, error: e2 } = await supabase
    .from("organizations")
    .select("id")
    .eq("athletic_department_id", athleticDepartmentId)
  if (e2) throw e2
  const orgIds = (orgs ?? []).map((o) => (o as { id: string }).id)
  if (orgIds.length > 0) {
    const { data: programs, error: e3 } = await supabase.from("programs").select("id").in("organization_id", orgIds)
    if (e3) throw e3
    const programIds = (programs ?? []).map((p) => (p as { id: string }).id)
    if (programIds.length > 0) {
      const { data: pm, error: e4 } = await supabase
        .from("program_members")
        .select("user_id")
        .in("program_id", programIds)
        .eq("active", true)
      if (e4) throw e4
      for (const r of pm ?? []) {
        const id = (r as { user_id?: string }).user_id
        if (id) users.add(id)
      }
    }
  }

  return users
}

export { assistantCoachUserIds, pickHeadCoachUserId, isHeadCoachRole, isAssistantCoachRole }
