import type { SupabaseClient } from "@supabase/supabase-js"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import { fetchAdPortalVisibleTeams } from "@/lib/ad-team-scope"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import {
  canAccessAdPortalRoutes,
  canPerformDepartmentOwnerActions,
  getAdPortalTabVisibility,
} from "@/lib/enforcement/football-ad-access"

async function loadPrimaryOrganizationName(
  supabase: SupabaseClient,
  organizationIds: string[]
): Promise<string | null> {
  if (organizationIds.length === 0) return null
  const { data } = await supabase.from("organizations").select("name").in("id", organizationIds).order("name")
  const row = data?.[0] as { name?: string | null } | undefined
  const n = row?.name?.trim()
  return n && n.length > 0 ? n : null
}

/**
 * Lightweight AD portal shell. Caller must redirect or 403 when `canAccessAdPortalRoutes` is false;
 * this function still validates and throws `AD_BOOTSTRAP_FORBIDDEN` for defense in depth.
 */
export async function buildAppAdPortalBootstrapPayload(
  supabase: SupabaseClient,
  input: {
    userId: string
    email: string
    liteRole: string
    isPlatformOwner: boolean
  }
): Promise<AppAdPortalBootstrapPayload> {
  const roleUpper = input.liteRole.toUpperCase().replace(/ /g, "_")

  const { scope, orFilter, teams: teamRows, error: teamsQueryError, footballAccess } =
    await fetchAdPortalVisibleTeams(supabase, input.userId, "picklist")

  if (!canAccessAdPortalRoutes(footballAccess)) {
    throw new Error("AD_BOOTSTRAP_FORBIDDEN")
  }

  const [adPortalAccess, profileRes, deptRes, primaryOrganizationName] = await Promise.all([
    getAdPortalAccessForUser(supabase, input.userId, roleUpper),
    supabase.from("profiles").select("full_name, school_id").eq("id", input.userId).maybeSingle(),
    supabase
      .from("athletic_departments")
      .select("id, status")
      .eq("athletic_director_user_id", input.userId)
      .maybeSingle(),
    loadPrimaryOrganizationName(supabase, scope.organizationIds),
  ])

  const profile = profileRes.data as { full_name?: string | null; school_id?: string | null } | null
  const fullName = profile?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  let school: { id: string | null; name: string | null } = { id: null, name: null }
  const schoolId = profile?.school_id ?? null
  if (schoolId) {
    const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle()
    const nm = (schoolRow as { name?: string | null } | null)?.name?.trim()
    school = { id: schoolId, name: nm && nm.length > 0 ? nm : null }
  }

  let program: AppAdPortalBootstrapPayload["program"] = null
  if (footballAccess.programId) {
    const { data: pr } = await supabase
      .from("programs")
      .select("id, name, sport")
      .eq("id", footballAccess.programId)
      .maybeSingle()
    if (pr && (pr as { id?: string }).id) {
      const row = pr as { id: string; name?: string | null; sport?: string | null }
      program = {
        id: row.id,
        name: row.name?.trim() ?? null,
        sport: row.sport ?? null,
      }
    }
  }

  const teamsSummary: AppAdPortalBootstrapPayload["teamsSummary"] = teamRows.map((t) => ({
    id: t.id,
    name: (t.name ?? "").trim() || "—",
    programId: t.program_id ?? null,
    sport: t.sport ?? null,
    teamLevel: t.team_level ?? null,
    gender: t.gender ?? null,
  }))

  const dept = deptRes.data as { id?: string; status?: string | null } | null

  return {
    portal: "ad",
    user: {
      id: input.userId,
      email: input.email,
      role: roleUpper,
      displayName,
      isPlatformOwner: input.isPlatformOwner,
    },
    organization: {
      athleticDepartmentId: dept?.id ?? scope.athleticDepartmentId,
      departmentStatus: dept?.status?.trim() ?? null,
      organizationIds: scope.organizationIds,
      primaryOrganizationName,
    },
    school,
    program,
    teamsSummary,
    scope,
    orFilter,
    teamsQueryError,
    adPortalAccess,
    flags: {
      tabVisibility: getAdPortalTabVisibility(footballAccess),
      canPerformDepartmentOwnerActions: canPerformDepartmentOwnerActions(footballAccess),
      accessState: footballAccess.state,
      programId: footballAccess.programId,
      primaryTeamId: footballAccess.primaryTeamId,
    },
    generatedAt: new Date().toISOString(),
  }
}
