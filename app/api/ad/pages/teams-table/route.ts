import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getAdPortalAccessForUser, type AdPortalAccess } from "@/lib/ad-portal-access"
import { adTeamsFlowPerfLog, shouldLogAdTeamsFlowPerf } from "@/lib/ad/ad-teams-table-perf"
import { adTeamsTableCacheTagForUser } from "@/lib/ad/ad-teams-table-server-cache"
import {
  loadAdTeamsTableData,
  type AdTeamsTableAuthUser,
} from "@/lib/ad/load-ad-teams-page-rows"
import {
  canAccessAdPortalRoutes,
  resolveFootballAdAccessState,
  type FootballAdAccessContext,
} from "@/lib/enforcement/football-ad-access"

export const runtime = "nodejs"

/** Browser cache for the signed-in user’s team list (not `public` — rows are account-specific). */
const TEAMS_TABLE_CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=120"

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

export async function GET() {
  const t0 = performance.now()
  const devLog = shouldLogAdTeamsFlowPerf()
  try {
    const t1 = performance.now()
    const sessionResult = await getRequestAuth()
    if (devLog) adTeamsFlowPerfLog("route", "getRequestAuth", performance.now() - t1)

    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
      adTeamsFlowPerfLog("route", "parallel_dept_football_ad_access", performance.now() - t2, {
        canEnterAdPortal: canAccessAdPortalRoutes(footballAccess),
        adMode: adPortalAccess.mode,
      })
    }

    if (!canAccessAdPortalRoutes(footballAccess)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
    if (devLog) adTeamsFlowPerfLog("route", "loadAdTeamsTableData_total", performance.now() - t4, {
      rowCount: teams.length,
      serverRowCache: useServerRowCache,
    })

    if (devLog) {
      adTeamsFlowPerfLog("route", "GET_total", performance.now() - t0, {
        userId: u.id,
        rowCount: teams.length,
        serverRowCache: useServerRowCache,
      })
    }

    const res = NextResponse.json({ teams })
    res.headers.set("Cache-Control", TEAMS_TABLE_CACHE_CONTROL)
    if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    return res
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "AD_BOOTSTRAP_FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("[GET /api/ad/pages/teams-table]", err)
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 })
  }
}
