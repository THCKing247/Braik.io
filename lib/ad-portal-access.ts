import type { SupabaseClient } from "@supabase/supabase-js"
import { pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

/**
 * Athletic Director portal governance (replaces separate “football program director” as the top shell).
 * - full_owner: real AD, department owner, or varsity HC with no external AD on linked orgs
 * - restricted_football: varsity HC under an org that has another user as athletic director
 */
export type AdPortalAccessMode = "none" | "full_owner" | "restricted_football"

export type AdPortalAccess = {
  mode: AdPortalAccessMode
  /** Football program ids for program_id-scoped team queries */
  footballProgramIds: string[]
  /** department = school/dept/org-linked teams; program_ids = teams in footballProgramIds only */
  teamQuery: "department" | "program_ids"
}

function isFootballSport(sport: string | null | undefined): boolean {
  const s = String(sport ?? "")
    .trim()
    .toLowerCase()
  return s === "" || s === "football"
}

/** Batch-resolve athletic director user id per organization (2 queries total vs 2× per org). */
async function mapOrganizationIdsToAthleticDirectorUserId(
  supabase: SupabaseClient,
  organizationIds: (string | null | undefined)[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  const unique = [...new Set(organizationIds.filter((id): id is string => Boolean(id)))]
  for (const id of unique) out.set(id, null)
  if (unique.length === 0) return out

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, athletic_department_id")
    .in("id", unique)

  const deptIds = [
    ...new Set(
      (orgs ?? [])
        .map((o) => (o as { athletic_department_id?: string | null }).athletic_department_id)
        .filter((x): x is string => Boolean(x))
    ),
  ]

  const deptToAd = new Map<string, string | null>()
  if (deptIds.length > 0) {
    const { data: depts } = await supabase
      .from("athletic_departments")
      .select("id, athletic_director_user_id")
      .in("id", deptIds)
    for (const d of depts ?? []) {
      const row = d as { id: string; athletic_director_user_id?: string | null }
      deptToAd.set(row.id, row.athletic_director_user_id ?? null)
    }
  }

  for (const o of orgs ?? []) {
    const oid = (o as { id: string }).id
    const did = (o as { athletic_department_id?: string | null }).athletic_department_id
    const adUid = did ? deptToAd.get(did) ?? null : null
    out.set(oid, adUid)
  }
  return out
}

/**
 * Head coaches only get football AD portal entry (and the HC-shell “Department” link) when they are
 * program director_of_football or primary head on Varsity (or legacy team_level unset) for that program.
 * JV/Freshman-only heads stay team-scoped and do not see AD portal affordances.
 */
/**
 * Varsity HC / director eligibility: one program_members query, then at most one teams + one team_members
 * query for all programs that need varsity checks (avoids per-program round trips).
 */
async function filterProgramIdsForVarsityAdPortalEligibility(
  supabase: SupabaseClient,
  userId: string,
  programIds: string[]
): Promise<string[]> {
  if (programIds.length === 0) return []

  const { data: rows } = await supabase
    .from("program_members")
    .select("program_id, role")
    .eq("user_id", userId)
    .eq("active", true)
    .in("program_id", programIds)

  const rolesByProgram = new Map<string, Set<string>>()
  for (const r of rows ?? []) {
    const pid = String((r as { program_id: string }).program_id)
    if (!rolesByProgram.has(pid)) rolesByProgram.set(pid, new Set())
    rolesByProgram.get(pid)!.add(String((r as { role: string }).role))
  }

  const directorPrograms = new Set<string>()
  const needsVarsityCheck: string[] = []
  for (const pid of programIds) {
    const roleSet = rolesByProgram.get(pid) ?? new Set()
    if (roleSet.has("director_of_football")) {
      directorPrograms.add(pid)
    } else if (roleSet.has("head_coach")) {
      needsVarsityCheck.push(pid)
    }
  }

  const eligibleFromVarsity = new Set<string>()
  if (needsVarsityCheck.length > 0) {
    const needsSet = new Set(needsVarsityCheck)
    const { data: teams } = await supabase
      .from("teams")
      .select("id, program_id, team_level")
      .in("program_id", needsVarsityCheck)

    const candidatesByProgram = new Map<string, string[]>()
    for (const pid of needsVarsityCheck) candidatesByProgram.set(pid, [])

    for (const t of teams ?? []) {
      const pid = String((t as { program_id: string }).program_id)
      if (!needsSet.has(pid)) continue
      const tl = String((t as { team_level?: string | null }).team_level ?? "")
        .trim()
        .toLowerCase()
      if (tl !== "varsity" && tl !== "") continue
      const id = (t as { id: string }).id
      candidatesByProgram.get(pid)!.push(id)
    }

    const allCandidateIds = [...new Set([...candidatesByProgram.values()].flat())]
    let staffByTeam = new Map<string, TeamMemberStaffRow[]>()
    if (allCandidateIds.length > 0) {
      const { data: staff } = await supabase
        .from("team_members")
        .select("team_id, user_id, role, is_primary")
        .eq("user_id", userId)
        .eq("active", true)
        .in("team_id", allCandidateIds)

      staffByTeam = new Map()
      for (const s of staff ?? []) {
        const tid = String((s as { team_id: string }).team_id)
        if (!staffByTeam.has(tid)) staffByTeam.set(tid, [])
        staffByTeam.get(tid)!.push({
          user_id: (s as { user_id: string }).user_id,
          role: (s as { role: string }).role,
          is_primary: (s as { is_primary?: boolean | null }).is_primary,
        })
      }
    }

    for (const pid of needsVarsityCheck) {
      const teamIds = candidatesByProgram.get(pid) ?? []
      const combined: TeamMemberStaffRow[] = []
      for (const tid of teamIds) {
        for (const row of staffByTeam.get(tid) ?? []) combined.push(row)
      }
      if (pickHeadCoachUserId(combined) === userId) eligibleFromVarsity.add(pid)
    }
  }

  const ordered: string[] = []
  for (const pid of programIds) {
    if (directorPrograms.has(pid) || eligibleFromVarsity.has(pid)) ordered.push(pid)
  }
  return ordered
}

export async function getAdPortalAccessForUser(
  supabase: SupabaseClient,
  userId: string,
  sessionRoleUpper: string | null | undefined,
  opts?: {
    /** When set (including null), skips athletic_departments row where this user is the licensed AD. */
    prefetchedMyDeptRow?: { id: string } | null
  }
): Promise<AdPortalAccess> {
  const role = sessionRoleUpper?.toUpperCase() ?? ""

  if (role === "ATHLETIC_DIRECTOR") {
    return { mode: "full_owner", footballProgramIds: [], teamQuery: "department" }
  }

  let myDept: { id: string } | null
  if (opts?.prefetchedMyDeptRow !== undefined) {
    myDept = opts.prefetchedMyDeptRow
  } else {
    const { data } = await supabase
      .from("athletic_departments")
      .select("id")
      .eq("athletic_director_user_id", userId)
      .maybeSingle()
    myDept = data?.id ? { id: data.id } : null
  }

  if (myDept && role === "HEAD_COACH") {
    return { mode: "full_owner", footballProgramIds: [], teamQuery: "department" }
  }

  if (role !== "HEAD_COACH") {
    return { mode: "none", footballProgramIds: [], teamQuery: "department" }
  }

  const { data: pmRows } = await supabase
    .from("program_members")
    .select("program_id")
    .eq("user_id", userId)
    .eq("active", true)
    .in("role", ["head_coach", "director_of_football"])

  let programIds = [...new Set((pmRows ?? []).map((r) => (r as { program_id: string }).program_id).filter(Boolean))]
  if (programIds.length === 0) {
    return { mode: "none", footballProgramIds: [], teamQuery: "department" }
  }

  programIds = await filterProgramIdsForVarsityAdPortalEligibility(supabase, userId, programIds)
  if (programIds.length === 0) {
    return { mode: "none", footballProgramIds: [], teamQuery: "department" }
  }

  const { data: programs } = await supabase
    .from("programs")
    .select("id, sport, organization_id")
    .in("id", programIds)

  const footballProgs = (programs ?? []).filter((p) => isFootballSport((p as { sport?: string }).sport))
  if (footballProgs.length === 0) {
    return { mode: "none", footballProgramIds: [], teamQuery: "department" }
  }

  const footballIds = footballProgs.map((p) => (p as { id: string }).id)

  const orgIdsForAd = footballProgs.map((p) => (p as { organization_id?: string | null }).organization_id)
  const orgToAdUser = await mapOrganizationIdsToAthleticDirectorUserId(supabase, orgIdsForAd)

  let hasExternalAd = false
  for (const p of footballProgs) {
    const orgId = (p as { organization_id?: string | null }).organization_id
    const adUid = orgId ? orgToAdUser.get(orgId) ?? null : null
    // When adUid is null, no AD has been assigned to this org yet.
    // The varsity HC receives full_owner access to initialize the program structure
    // for the future. When a real AD is later assigned, they will take over
    // and the HC will drop to restricted_football mode automatically.
    if (adUid && adUid !== userId) {
      hasExternalAd = true
      break
    }
  }

  if (hasExternalAd) {
    return { mode: "restricted_football", footballProgramIds: footballIds, teamQuery: "program_ids" }
  }

  return { mode: "full_owner", footballProgramIds: footballIds, teamQuery: "program_ids" }
}

export function adPortalShowsOverviewAndSettings(access: AdPortalAccess): boolean {
  return access.mode === "full_owner"
}
