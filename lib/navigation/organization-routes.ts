import type { SupabaseClient } from "@supabase/supabase-js"

type TeamIdentityRow = {
  id: string
  created_at?: string | null
  athletic_department_id?: string | null
  program_id?: string | null
}

export type CanonicalTeamRoute = {
  organizationPortalUuid: string
  shortTeamId: string
}

function toCanonicalPathSuffix(pathSuffix?: string): string {
  if (!pathSuffix || pathSuffix === "/") return ""
  return pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`
}

function normalizeShortTeamId(value: string): string {
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return trimmed.padStart(3, "0")
  return trimmed
}

export function buildOrganizationPortalPath(organizationPortalUuid: string, pagePath?: string): string {
  const suffix = toCanonicalPathSuffix(pagePath)
  return `/org/${encodeURIComponent(organizationPortalUuid)}${suffix}`
}

export function buildDashboardTeamPath(input: CanonicalTeamRoute, nestedPath?: string): string {
  const suffix = toCanonicalPathSuffix(nestedPath)
  return `/dashboard/org/${encodeURIComponent(input.organizationPortalUuid)}/team/${encodeURIComponent(input.shortTeamId)}${suffix}`
}

async function resolveOrganizationPortalUuidFromProgram(
  supabase: SupabaseClient,
  programId: string | null | undefined
): Promise<string | null> {
  if (!programId) return null
  const { data: program } = await supabase
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .maybeSingle()
  const organizationId = (program as { organization_id?: string | null } | null)?.organization_id ?? null
  if (!organizationId) return null
  const { data: organization } = await supabase
    .from("organizations")
    .select("athletic_department_id")
    .eq("id", organizationId)
    .maybeSingle()
  return (organization as { athletic_department_id?: string | null } | null)?.athletic_department_id ?? null
}

async function fetchOrganizationTeams(
  supabase: SupabaseClient,
  organizationPortalUuid: string
): Promise<TeamIdentityRow[]> {
  const [directTeamsRes, orgRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, created_at, athletic_department_id, program_id")
      .eq("athletic_department_id", organizationPortalUuid),
    supabase
      .from("organizations")
      .select("id")
      .eq("athletic_department_id", organizationPortalUuid),
  ])

  const directTeams = (directTeamsRes.data ?? []) as TeamIdentityRow[]
  const organizationIds = (orgRes.data ?? []).map((r) => r.id).filter(Boolean)

  if (organizationIds.length === 0) {
    return directTeams
  }

  const { data: programs } = await supabase
    .from("programs")
    .select("id")
    .in("organization_id", organizationIds)

  const programIds = (programs ?? []).map((r) => r.id).filter(Boolean)
  if (programIds.length === 0) {
    return directTeams
  }

  const { data: programTeams } = await supabase
    .from("teams")
    .select("id, created_at, athletic_department_id, program_id")
    .in("program_id", programIds)

  const all = [...directTeams, ...((programTeams ?? []) as TeamIdentityRow[])]
  const byId = new Map<string, TeamIdentityRow>()
  for (const row of all) {
    if (!row?.id) continue
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

function sortTeamsForShortId(rows: TeamIdentityRow[]): TeamIdentityRow[] {
  return [...rows].sort((a, b) => {
    const aTs = a.created_at ? Date.parse(a.created_at) : 0
    const bTs = b.created_at ? Date.parse(b.created_at) : 0
    if (aTs !== bTs) return aTs - bTs
    return a.id.localeCompare(b.id)
  })
}

export async function resolveOrganizationPortalUuidForTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<string | null> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, athletic_department_id, program_id")
    .eq("id", teamId)
    .maybeSingle()
  if (!team?.id) return null
  const direct = (team as { athletic_department_id?: string | null }).athletic_department_id ?? null
  if (direct) return direct
  return resolveOrganizationPortalUuidFromProgram(
    supabase,
    (team as { program_id?: string | null }).program_id ?? null
  )
}

export async function resolveCanonicalTeamRouteByTeamId(
  supabase: SupabaseClient,
  teamId: string
): Promise<CanonicalTeamRoute | null> {
  const organizationPortalUuid = await resolveOrganizationPortalUuidForTeam(supabase, teamId)
  if (!organizationPortalUuid) return null
  const allTeams = sortTeamsForShortId(await fetchOrganizationTeams(supabase, organizationPortalUuid))
  const index = allTeams.findIndex((t) => t.id === teamId)
  if (index < 0) return null
  return {
    organizationPortalUuid,
    shortTeamId: String(index + 1).padStart(3, "0"),
  }
}

export async function resolveTeamIdFromOrganizationShortId(
  supabase: SupabaseClient,
  organizationPortalUuid: string,
  shortTeamId: string
): Promise<string | null> {
  const normalized = normalizeShortTeamId(shortTeamId)
  if (!/^\d{3,}$/.test(normalized)) return null
  const ordinal = Number.parseInt(normalized, 10)
  if (!Number.isFinite(ordinal) || ordinal <= 0) return null
  const allTeams = sortTeamsForShortId(await fetchOrganizationTeams(supabase, organizationPortalUuid))
  return allTeams[ordinal - 1]?.id ?? null
}

export async function resolveDefaultOrganizationPortalUuidForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: dept } = await supabase
    .from("athletic_departments")
    .select("id")
    .eq("athletic_director_user_id", userId)
    .maybeSingle()
  if (dept?.id) return dept.id

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", userId)
    .maybeSingle()
  const profileTeamId = (profile as { team_id?: string | null } | null)?.team_id ?? null
  if (profileTeamId) {
    const viaProfile = await resolveOrganizationPortalUuidForTeam(supabase, profileTeamId)
    if (viaProfile) return viaProfile
  }

  const { data: memberRow } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle()
  const memberTeamId = (memberRow as { team_id?: string | null } | null)?.team_id ?? null
  if (!memberTeamId) return null
  return resolveOrganizationPortalUuidForTeam(supabase, memberTeamId)
}
