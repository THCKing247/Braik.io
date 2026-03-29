import type { SupabaseClient } from "@supabase/supabase-js"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import { fetchAdPortalVisibleTeams } from "@/lib/ad-team-scope"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import {
  canAccessAdPortalRoutes,
  canPerformDepartmentOwnerActions,
  getAdPortalTabVisibility,
  resolveFootballAdAccessState,
} from "@/lib/enforcement/football-ad-access"

const shouldLogAdPortalBootstrapPerf =
  process.env.NODE_ENV === "development" || process.env.AD_PORTAL_BOOTSTRAP_PERF === "1"

function adPortalBootstrapPerfLog(phase: string, ms: number, extra?: Record<string, unknown>): void {
  if (!shouldLogAdPortalBootstrapPerf) return
  console.info(`[ad-portal-bootstrap-perf] ${phase}`, {
    ms: Math.round(ms * 10) / 10,
    ...extra,
  })
}

async function loadPrimaryOrganizationName(
  supabase: SupabaseClient,
  organizationIds: string[]
): Promise<string | null> {
  if (organizationIds.length === 0) return null
  const { data } = await supabase
    .from("organizations")
    .select("name")
    .in("id", organizationIds)
    .order("name")
    .limit(1)
  const row = data?.[0] as { name?: string | null } | undefined
  const n = row?.name?.trim()
  return n && n.length > 0 ? n : null
}

/**
 * Lightweight AD portal shell. Caller must redirect or 403 when `canAccessAdPortalRoutes` is false;
 * this function still validates and throws `AD_BOOTSTRAP_FORBIDDEN` for defense in depth.
 *
 * Perf: one `resolveFootballAdAccessState`, then `fetchAdPortalVisibleTeams` with `reuseFootballAccess`
 * (avoids duplicate football resolution inside the teams fetch). One parallel batch for access, profile,
 * department, primary org name (limit 1), and program; school row only after profile (needs school_id).
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
  const tAll = performance.now()

  const tFootball = performance.now()
  const footballAccess = await resolveFootballAdAccessState(supabase, input.userId)
  adPortalBootstrapPerfLog("resolveFootballAdAccessState", performance.now() - tFootball, {
    userId: input.userId,
  })

  if (!canAccessAdPortalRoutes(footballAccess)) {
    throw new Error("AD_BOOTSTRAP_FORBIDDEN")
  }

  const tTeams = performance.now()
  const { scope, orFilter, teams: teamRows, error: teamsQueryError, footballAccess: fa } =
    await fetchAdPortalVisibleTeams(supabase, input.userId, "picklist", {
      reuseFootballAccess: footballAccess,
    })
  adPortalBootstrapPerfLog("fetchAdPortalVisibleTeams_picklist", performance.now() - tTeams, {
    teamCount: teamRows.length,
  })

  const programId = fa.programId

  const tParallel = performance.now()
  const [adPortalAccess, profileRes, deptRes, primaryOrganizationName, programRes] = await Promise.all([
    getAdPortalAccessForUser(supabase, input.userId, roleUpper),
    supabase.from("profiles").select("full_name, school_id").eq("id", input.userId).maybeSingle(),
    supabase
      .from("athletic_departments")
      .select("id, status")
      .eq("athletic_director_user_id", input.userId)
      .maybeSingle(),
    loadPrimaryOrganizationName(supabase, scope.organizationIds),
    programId
      ? supabase.from("programs").select("id, name, sport").eq("id", programId).maybeSingle()
      : Promise.resolve({ data: null as { id?: string; name?: string | null; sport?: string | null } | null }),
  ])
  adPortalBootstrapPerfLog("parallel_shell_batch", performance.now() - tParallel, {
    hasProgramId: Boolean(programId),
  })

  const profile = profileRes.data as { full_name?: string | null; school_id?: string | null } | null
  const fullName = profile?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  const schoolId = profile?.school_id ?? null
  let school: { id: string | null; name: string | null } = { id: null, name: null }
  if (schoolId) {
    const tSchool = performance.now()
    const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle()
    adPortalBootstrapPerfLog("school_lookup", performance.now() - tSchool)
    const nm = (schoolRow as { name?: string | null } | null)?.name?.trim()
    school = { id: schoolId, name: nm && nm.length > 0 ? nm : null }
  }

  let program: AppAdPortalBootstrapPayload["program"] = null
  const pr = programRes.data
  if (pr && (pr as { id?: string }).id) {
    const row = pr as { id: string; name?: string | null; sport?: string | null }
    program = {
      id: row.id,
      name: row.name?.trim() ?? null,
      sport: row.sport ?? null,
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

  adPortalBootstrapPerfLog("buildAppAdPortalBootstrapPayload_total", performance.now() - tAll, {
    userId: input.userId,
    teamsSummary: teamsSummary.length,
  })

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
      tabVisibility: getAdPortalTabVisibility(fa),
      canPerformDepartmentOwnerActions: canPerformDepartmentOwnerActions(fa),
      accessState: fa.state,
      programId: fa.programId,
      primaryTeamId: fa.primaryTeamId,
    },
    generatedAt: new Date().toISOString(),
  }
}
