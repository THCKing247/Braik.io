import { unstable_cache } from "next/cache"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { adTeamsFlowPerfLog, shouldLogAdTeamsFlowPerf } from "@/lib/ad/ad-teams-table-perf"
import { adTeamsTableCacheTagForUser } from "@/lib/ad/ad-teams-table-server-cache"
import {
  loadAdTeamsTableData,
  type AdTeamsTableAuthUser,
} from "@/lib/ad/load-ad-teams-page-rows"
import type { RefreshedSession } from "@/lib/auth/server-auth"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getAdPortalAccessForUser, type AdPortalAccess } from "@/lib/ad-portal-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  canAccessAdPortalRoutes,
  resolveFootballAdAccessState,
  type FootballAdAccessContext,
} from "@/lib/enforcement/football-ad-access"

function adPortalAccessCacheKey(a: AdPortalAccess): string {
  return JSON.stringify({
    mode: a.mode,
    teamQuery: a.teamQuery,
    footballProgramIds: [...a.footballProgramIds].sort(),
  })
}

function parseAdPortalAccessCacheKey(s: string): AdPortalAccess {
  const j = JSON.parse(s) as {
    mode: AdPortalAccess["mode"]
    teamQuery: AdPortalAccess["teamQuery"]
    footballProgramIds: string[]
  }
  return {
    mode: j.mode,
    teamQuery: j.teamQuery,
    footballProgramIds: Array.isArray(j.footballProgramIds) ? j.footballProgramIds : [],
  }
}

function footballAccessCacheKey(c: FootballAdAccessContext): string {
  return JSON.stringify({
    state: c.state,
    programId: c.programId,
    primaryTeamId: c.primaryTeamId,
    departmentOwnerUserId: c.departmentOwnerUserId,
    isDepartmentAthleticDirector: c.isDepartmentAthleticDirector,
  })
}

function parseFootballAccessCacheKey(s: string): FootballAdAccessContext {
  return JSON.parse(s) as FootballAdAccessContext
}

export type LoadAdTeamsTableForRequestResult =
  | { ok: true; teams: TeamRow[]; refreshedSession?: RefreshedSession }
  | { ok: false; kind: "unauthorized" }
  | { ok: false; kind: "forbidden" }
  | { ok: false; kind: "server_error" }

/**
 * Shared by `GET /api/ad/pages/teams-table` and the server-rendered `/dashboard/ad/teams` page
 * so the first paint can include real rows without waiting on client bootstrap.
 */
export async function loadAdTeamsTableForRequest(): Promise<LoadAdTeamsTableForRequestResult> {
  const t0 = performance.now()
  const devLog = shouldLogAdTeamsFlowPerf()
  try {
    const t1 = performance.now()
    const sessionResult = await getRequestAuth()
    if (devLog) adTeamsFlowPerfLog("loadAdTeamsTableForRequest", "getRequestAuth", performance.now() - t1)

    if (!sessionResult?.user?.id) {
      return { ok: false, kind: "unauthorized" }
    }
    const u = sessionResult.user
    const supabase = getSupabaseServer()
    const roleUpper = (u.role ?? "").toUpperCase().replace(/ /g, "_")

    const directorDeptPromise = supabase
      .from("athletic_departments")
      .select("id")
      .eq("athletic_director_user_id", u.id)
      .maybeSingle()

    const t2 = performance.now()
    const [deptRes, footballAccess, adPortalAccess] = await Promise.all([
      directorDeptPromise,
      directorDeptPromise.then(({ data }) =>
        resolveFootballAdAccessState(supabase, u.id, {
          prefetchedProfile: { role: u.profileRoleDb ?? null, team_id: u.profileTeamId ?? null },
          prefetchedDirectorDept: data?.id ? { id: data.id } : null,
        })
      ),
      directorDeptPromise.then(({ data }) =>
        getAdPortalAccessForUser(supabase, u.id, roleUpper, {
          prefetchedMyDeptRow: data?.id ? { id: data.id } : null,
        })
      ),
    ])
    if (devLog) {
      adTeamsFlowPerfLog("loadAdTeamsTableForRequest", "parallel_dept_football_ad_access", performance.now() - t2, {
        canEnterAdPortal: canAccessAdPortalRoutes(footballAccess),
        adMode: adPortalAccess.mode,
      })
    }

    if (!canAccessAdPortalRoutes(footballAccess)) {
      return { ok: false, kind: "forbidden" }
    }

    const accessKey = adPortalAccessCacheKey(adPortalAccess)
    const fcKey = footballAccessCacheKey(footballAccess)
    const userLite: AdTeamsTableAuthUser = {
      id: u.id,
      role: u.role ?? "",
      isPlatformOwner: u.isPlatformOwner === true,
      profileRoleDb: u.profileRoleDb ?? null,
      profileTeamId: u.profileTeamId ?? null,
      profileSchoolId: u.profileSchoolId ?? null,
      directorDeptAsUser: deptRes.data?.id ? { id: deptRes.data.id } : null,
    }

    const useServerRowCache =
      process.env.NODE_ENV === "production" && process.env.AD_TEAMS_TABLE_SERVER_CACHE !== "0"

    const t4 = performance.now()
    let teams: Awaited<ReturnType<typeof loadAdTeamsTableData>>
    if (useServerRowCache) {
      teams = await unstable_cache(
        async () => {
          const sb = getSupabaseServer()
          return loadAdTeamsTableData(
            sb,
            userLite,
            parseAdPortalAccessCacheKey(accessKey),
            parseFootballAccessCacheKey(fcKey)
          )
        },
        ["ad-teams-table-rows", u.id, accessKey, fcKey],
        { revalidate: 60, tags: [adTeamsTableCacheTagForUser(u.id)] }
      )()
    } else {
      teams = await loadAdTeamsTableData(supabase, userLite, adPortalAccess, footballAccess)
    }
    if (devLog) {
      adTeamsFlowPerfLog("loadAdTeamsTableForRequest", "loadAdTeamsTableData_total", performance.now() - t4, {
        rowCount: teams.length,
        serverRowCache: useServerRowCache,
      })
    }

    if (devLog) {
      adTeamsFlowPerfLog("loadAdTeamsTableForRequest", "total", performance.now() - t0, {
        userId: u.id,
        rowCount: teams.length,
        serverRowCache: useServerRowCache,
      })
    }

    return {
      ok: true,
      teams,
      refreshedSession: sessionResult.refreshedSession,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "AD_BOOTSTRAP_FORBIDDEN") {
      return { ok: false, kind: "forbidden" }
    }
    console.error("[loadAdTeamsTableForRequest]", err)
    return { ok: false, kind: "server_error" }
  }
}
