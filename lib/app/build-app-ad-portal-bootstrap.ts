import type { SupabaseClient } from "@supabase/supabase-js"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import {
  fetchAdPortalVisibleTeams,
  type AthleticDirectorScopePrefetch,
} from "@/lib/ad-team-scope"
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

  const tShell = performance.now()
  const [profileShellRes, deptShellRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, team_id, school_id, full_name")
      .eq("id", input.userId)
      .maybeSingle(),
    supabase
      .from("athletic_departments")
      .select("id, status")
      .eq("athletic_director_user_id", input.userId)
      .maybeSingle(),
  ])
  adPortalBootstrapPerfLog("profile_and_dept_shell_parallel", performance.now() - tShell, {
    userId: input.userId,
  })

  const profileData = profileShellRes.data as {
    role?: string | null
    team_id?: string | null
    school_id?: string | null
    full_name?: string | null
  } | null
  const deptData = deptShellRes.data as { id: string; status?: string | null } | null
  const directorDeptRow = deptData?.id ? { id: deptData.id } : null

  const tFootball = performance.now()
  const footballAccess = await resolveFootballAdAccessState(supabase, input.userId, {
    prefetchedProfile: profileData
      ? { role: profileData.role, team_id: profileData.team_id }
      : undefined,
    prefetchedDirectorDept: directorDeptRow,
  })
  adPortalBootstrapPerfLog("resolveFootballAdAccessState", performance.now() - tFootball, {
    userId: input.userId,
  })

  if (!canAccessAdPortalRoutes(footballAccess)) {
    throw new Error("AD_BOOTSTRAP_FORBIDDEN")
  }

  const scopePrefetch: AthleticDirectorScopePrefetch = {
    deptAsDirector: directorDeptRow,
  }
  if (profileData) {
    scopePrefetch.profile = {
      school_id: profileData.school_id ?? null,
      role: profileData.role ?? null,
    }
  }

  const tTeamsAndAccess = performance.now()
  const [
    { scope, orFilter, teams: teamRows, error: teamsQueryError, footballAccess: fa },
    adPortalAccess,
  ] = await Promise.all([
    fetchAdPortalVisibleTeams(supabase, input.userId, "picklist", {
      reuseFootballAccess: footballAccess,
      scopePrefetch,
    }),
    getAdPortalAccessForUser(supabase, input.userId, roleUpper, {
      prefetchedMyDeptRow: directorDeptRow,
    }),
  ])
  adPortalBootstrapPerfLog("fetch_picklist_and_getAdPortal_parallel", performance.now() - tTeamsAndAccess, {
    teamCount: teamRows.length,
  })

  const programId = fa.programId

  const tParallel = performance.now()
  const [primaryOrganizationName, programRes] = await Promise.all([
    loadPrimaryOrganizationName(supabase, scope.organizationIds),
    programId
      ? supabase.from("programs").select("id, name, sport").eq("id", programId).maybeSingle()
      : Promise.resolve({ data: null as { id?: string; name?: string | null; sport?: string | null } | null }),
  ])
  adPortalBootstrapPerfLog("parallel_org_and_program", performance.now() - tParallel, {
    hasProgramId: Boolean(programId),
  })

  const fullName = profileData?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  const schoolId = profileData?.school_id ?? null
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

  const dept = deptData

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
