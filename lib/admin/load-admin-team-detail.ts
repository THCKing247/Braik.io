import type { OwnershipSource } from "@/lib/admin/load-admin-teams-grouped"
import {
  isAssistantCoachRole,
  isHeadCoachRole,
  pickHeadCoachUserId,
  type TeamMemberStaffRow,
} from "@/lib/team-staff"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

type OrgRow = {
  id: string
  name: string | null
  school_id: string | null
  athletic_department_id: string | null
}

type ProgramRow = {
  id: string
  program_name: string | null
  sport: string | null
  organization_id: string | null
}

type SchoolRow = { id: string; name: string | null }
type AdRow = { id: string; school_id: string | null }

export type AdminTeamDetailModel = {
  id: string
  name: string
  planTier: string | null
  subscriptionStatus: string
  teamStatus: string
  sport: string | null
  teamLevel: string | null
  createdAt: string
  programId: string | null
  programName: string | null
  teamSchoolId: string | null
  teamAthleticDepartmentId: string | null
  organization: { id: string | null; name: string }
  ownershipSource: OwnershipSource
  ownershipSummary: string
  legacyNotes: string | null
  headCoachName: string | null
  coachStaffCount: number
  schoolDisplay: string | null
  athleticDepartmentDisplay: string | null
}

export type LoadAdminTeamDetailResult =
  | { ok: true; data: AdminTeamDetailModel }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "query_error"; message: string }

const TEAMS_SELECT =
  "id, name, plan_tier, subscription_status, team_status, organization_id, created_at, sport, team_level, program_id, school_id, athletic_department_id"

function ownershipSummary(source: OwnershipSource): string {
  switch (source) {
    case "team_organization_id":
      return "teams.organization_id"
    case "program_organization_id":
      return "programs.organization_id (via team.program_id)"
    case "organization_athletic_department":
      return "Inferred: unique organization for this athletic department"
    case "organization_school":
      return "Inferred: unique organization for this school"
    default:
      return "Not linked to an organization — assign teams.organization_id or link the program"
  }
}

export async function loadAdminTeamDetail(teamId: string): Promise<LoadAdminTeamDetailResult> {
  const id = teamId?.trim()
  if (!id) {
    return { ok: false, kind: "query_error", message: "Missing team id" }
  }

  const supabase = getSupabaseServer()

  const { data: teamRow, error: teamErr } = await supabase.from("teams").select(TEAMS_SELECT).eq("id", id).maybeSingle()

  if (teamErr) {
    return { ok: false, kind: "query_error", message: teamErr.message }
  }
  if (!teamRow) {
    return { ok: false, kind: "not_found" }
  }

  const t = teamRow as Record<string, unknown>

  const pid = (t.program_id as string | null)?.trim() || null
  let prog: ProgramRow | undefined
  if (pid) {
    const { data: p } = await supabase
      .from("programs")
      .select("id, program_name, sport, organization_id")
      .eq("id", pid)
      .maybeSingle()
    if (p) prog = p as ProgramRow
  }

  const { data: orgRowsFromDb } = await supabase
    .from("organizations")
    .select("id, name, school_id, athletic_department_id")
    .order("name", { ascending: true })
    .limit(501)

  let orgById = new Map<string, OrgRow>((orgRowsFromDb ?? []).map((o) => [o.id as string, o as OrgRow]))

  const referencedOrgIds = new Set<string>()
  const tidOid = (t.organization_id as string | null)?.trim()
  if (tidOid) referencedOrgIds.add(tidOid)
  if (prog?.organization_id) referencedOrgIds.add(prog.organization_id.trim())

  const missingOrgIds = [...referencedOrgIds].filter((oid) => !orgById.has(oid))
  if (missingOrgIds.length > 0) {
    const { data: extraOrgs } = await supabase
      .from("organizations")
      .select("id, name, school_id, athletic_department_id")
      .in("id", missingOrgIds)
    for (const o of extraOrgs ?? []) {
      const r = o as OrgRow
      orgById.set(r.id, r)
    }
  }

  const orgsByAthleticDepartmentId = new Map<string, OrgRow[]>()
  const orgsBySchoolId = new Map<string, OrgRow[]>()
  for (const o of orgById.values()) {
    if (o.athletic_department_id) {
      const list = orgsByAthleticDepartmentId.get(o.athletic_department_id) ?? []
      list.push(o)
      orgsByAthleticDepartmentId.set(o.athletic_department_id, list)
    }
    if (o.school_id) {
      const list = orgsBySchoolId.get(o.school_id) ?? []
      list.push(o)
      orgsBySchoolId.set(o.school_id, list)
    }
  }

  const directOid = ((t.organization_id as string | null) ?? "").trim() || null
  const oidFromProgram = prog?.organization_id?.trim() || null
  const fromTeamOrProgram = directOid ?? oidFromProgram ?? null

  const teamAdId = ((t.athletic_department_id as string | null) ?? "").trim() || null
  const sidTeam = (t.school_id as string | null) ?? null

  let inferredOid: string | null = null
  let inferredVia: "none" | "athletic_department" | "school" = "none"
  if (!fromTeamOrProgram && teamAdId) {
    const adMatches = orgsByAthleticDepartmentId.get(teamAdId) ?? []
    if (adMatches.length === 1) {
      inferredOid = adMatches[0].id
      inferredVia = "athletic_department"
    }
  }
  if (!fromTeamOrProgram && !inferredOid && sidTeam) {
    const schoolMatches = orgsBySchoolId.get(sidTeam) ?? []
    if (schoolMatches.length === 1) {
      inferredOid = schoolMatches[0].id
      inferredVia = "school"
    }
  }

  const effectiveOidFinal = fromTeamOrProgram ?? inferredOid ?? null

  let ownershipSource: OwnershipSource = "unassigned"
  if (directOid) ownershipSource = "team_organization_id"
  else if (oidFromProgram) ownershipSource = "program_organization_id"
  else if (inferredOid && inferredVia === "athletic_department") ownershipSource = "organization_athletic_department"
  else if (inferredOid && inferredVia === "school") ownershipSource = "organization_school"

  const orgRow = effectiveOidFinal ? orgById.get(effectiveOidFinal) : undefined
  const resolvedOrgName =
    (orgRow?.name && String(orgRow.name).trim()) ||
    (effectiveOidFinal ? `Unknown organization (${effectiveOidFinal.slice(0, 8)}…)` : null)

  const programName = (prog?.program_name as string | undefined)?.trim() || null

  const sidFromOrg = orgRow?.school_id ?? null
  const sid = sidTeam ?? sidFromOrg ?? null

  const schoolIdsNeeded = new Set<string>()
  if (sid) schoolIdsNeeded.add(sid)

  let adSchoolId: string | null = null
  if (teamAdId) {
    const { data: adRow } = await supabase.from("athletic_departments").select("id, school_id").eq("id", teamAdId).maybeSingle()
    adSchoolId = adRow ? ((adRow as AdRow).school_id as string | null) : null
    if (adSchoolId) schoolIdsNeeded.add(adSchoolId)
  }

  const { data: schools } =
    schoolIdsNeeded.size > 0
      ? await supabase.from("schools").select("id, name").in("id", [...schoolIdsNeeded])
      : { data: [] as SchoolRow[] }

  const schoolById = new Map<string, SchoolRow>((schools ?? []).map((s) => [s.id as string, s as SchoolRow]))

  let schoolName: string | null = null
  if (sid) {
    schoolName = (schoolById.get(sid)?.name as string | undefined) ?? null
  }

  let athleticDepartmentDisplay: string | null = null
  if (teamAdId) {
    const adschool = adSchoolId ? schoolById.get(adSchoolId)?.name : null
    athleticDepartmentDisplay = adschool
      ? `Athletic department → school: ${adschool}`
      : `Athletic department id ${teamAdId.slice(0, 8)}…`
  }

  const legacyParts: string[] = []
  if (prog && !prog.organization_id) {
    legacyParts.push(`Program "${programName ?? prog.id.slice(0, 8)}" has no organization_id`)
  }
  if (!fromTeamOrProgram && teamAdId) {
    const adMatches = orgsByAthleticDepartmentId.get(teamAdId) ?? []
    if (adMatches.length > 1) {
      legacyParts.push(`${adMatches.length} organizations share this athletic department — ambiguous`)
    }
  }
  if (!fromTeamOrProgram && !inferredOid && sidTeam) {
    const schoolMatches = orgsBySchoolId.get(sidTeam) ?? []
    if (schoolMatches.length > 1) {
      legacyParts.push(`${schoolMatches.length} organizations share this school — ambiguous`)
    }
  }

  const { data: staffRows } = await supabase
    .from("team_members")
    .select("team_id, user_id, role, is_primary")
    .eq("team_id", id)
    .eq("active", true)

  const staff: TeamMemberStaffRow[] = (staffRows ?? []).map((row) => ({
    user_id: row.user_id as string,
    role: row.role as string,
    is_primary: row.is_primary as boolean | null | undefined,
  }))

  const hcUid = pickHeadCoachUserId(staff)
  let headCoachName: string | null = null
  if (hcUid) {
    const { data: u } = await supabase.from("users").select("id, name").eq("id", hcUid).maybeSingle()
    headCoachName = ((u as { name?: string | null } | null)?.name ?? "").trim() || null
  }

  const coachStaffCount = staff.filter((m) => isHeadCoachRole(m.role) || isAssistantCoachRole(m.role)).length

  const createdRaw = t.created_at
  const createdAt =
    typeof createdRaw === "string"
      ? createdRaw
      : createdRaw
        ? new Date(createdRaw as string).toISOString()
        : new Date().toISOString()

  const model: AdminTeamDetailModel = {
    id: t.id as string,
    name: (t.name as string) ?? "—",
    planTier: (t.plan_tier as string | undefined) ?? null,
    subscriptionStatus: (t.subscription_status as string | undefined) ?? "active",
    teamStatus: (t.team_status as string | undefined) ?? "active",
    sport: (t.sport as string | null) ?? (prog?.sport as string | null) ?? null,
    teamLevel: (t.team_level as string | null) ?? null,
    createdAt,
    programId: pid,
    programName,
    teamSchoolId: sidTeam,
    teamAthleticDepartmentId: teamAdId,
    organization: { id: effectiveOidFinal, name: resolvedOrgName ?? "—" },
    ownershipSource,
    ownershipSummary: ownershipSummary(ownershipSource),
    legacyNotes: legacyParts.length > 0 ? legacyParts.join(" · ") : null,
    headCoachName,
    coachStaffCount,
    schoolDisplay: sidTeam ? schoolName ?? `school_id ${sidTeam.slice(0, 8)}…` : null,
    athleticDepartmentDisplay,
  }

  return { ok: true, data: model }
}
