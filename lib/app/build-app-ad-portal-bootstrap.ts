import type { SupabaseClient } from "@supabase/supabase-js"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { loadAdTeamsTableData, type AdTeamsTableAuthUser } from "@/lib/ad/load-ad-teams-page-rows"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import {
  buildAdTeamsOrFilter,
  mergeAdPortalScope,
  resolveAthleticDirectorScope,
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
 * Perf: optional `includeTeamsTable` embeds the same rows as GET /api/ad/pages/teams-table using the
 * already-resolved `adPortalAccess` + `footballAccess` (no duplicate access resolution).
 */
export async function buildAppAdPortalBootstrapPayload(
  supabase: SupabaseClient,
  input: {
    userId: string
    email: string
    liteRole: string
    isPlatformOwner: boolean
    /** When true, runs `loadAdTeamsTableData` once and attaches `teamsTable` to the payload. */
    includeTeamsTable?: boolean
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

  const tScopeAndAccess = performance.now()
  const [mergedScope, adPortalAccess] = await Promise.all([
    (async () => {
      const base = await resolveAthleticDirectorScope(supabase, input.userId, scopePrefetch)
      return mergeAdPortalScope(base, footballAccess)
    })(),
    getAdPortalAccessForUser(supabase, input.userId, roleUpper, {
      prefetchedMyDeptRow: directorDeptRow,
    }),
  ])
  const scope = mergedScope
  const orFilter = buildAdTeamsOrFilter(scope)
  adPortalBootstrapPerfLog("resolve_scope_and_getAdPortal_parallel", performance.now() - tScopeAndAccess, {
    userId: input.userId,
  })

  const programId = footballAccess.programId

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

  const teamsSummary: AppAdPortalBootstrapPayload["teamsSummary"] = []

  const dept = deptData

  let teamsTable: TeamRow[] | undefined
  let teamsTableError: string | null | undefined
  if (input.includeTeamsTable) {
    const tEmbed = performance.now()
    const userLite: AdTeamsTableAuthUser = {
      id: input.userId,
      role: roleUpper,
      isPlatformOwner: input.isPlatformOwner,
      profileRoleDb: profileData?.role ?? null,
      profileTeamId: profileData?.team_id ?? null,
      profileSchoolId: profileData?.school_id ?? null,
      directorDeptAsUser: directorDeptRow,
    }
    try {
      teamsTable = await loadAdTeamsTableData(supabase, userLite, adPortalAccess, footballAccess)
      teamsTableError = null
    } catch (err) {
      teamsTable = []
      teamsTableError = err instanceof Error ? err.message : String(err)
    }
    adPortalBootstrapPerfLog("embedded_teams_table", performance.now() - tEmbed, {
      userId: input.userId,
      rows: teamsTable?.length ?? 0,
    })
  }

  adPortalBootstrapPerfLog("buildAppAdPortalBootstrapPayload_total", performance.now() - tAll, {
    userId: input.userId,
    teamsSummary: 0,
    includeTeamsTable: Boolean(input.includeTeamsTable),
  })

  const base: AppAdPortalBootstrapPayload = {
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
    teamsQueryError: null,
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

  if (input.includeTeamsTable) {
    return { ...base, teamsTable, teamsTableError }
  }
  return base
}
