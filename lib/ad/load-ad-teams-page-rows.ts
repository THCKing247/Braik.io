import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdPortalAccess } from "@/lib/ad-portal-access"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import { adTeamsFlowPerfLog } from "@/lib/ad/ad-teams-table-perf"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { fetchAdVisibleTeamsForAccess, logAdTeamVisibility } from "@/lib/ad-team-scope"
import { pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"
import {
  canAccessAdPortalRoutes,
  resolveFootballAdAccessState,
  type FootballAdAccessContext,
} from "@/lib/enforcement/football-ad-access"

/**
 * AD teams table architecture:
 * - AD shell bootstrap does not load visible-team rows; this loader + GET /api/ad/pages/teams-table own them.
 * - Dedicated teams-table route: capped teams query (`table` mode), batched `team_members` / `invites`, etc.
 * - If product needs >500 teams, add cursor pagination here rather than growing payloads.
 */

/** React Query key for AD teams table — shared with visibility refresh invalidation. */
export const AD_TEAMS_TABLE_QUERY_KEY = ["ad-pages", "teams-table"] as const

/** PostgREST `.in("team_id", …)` chunk size to avoid huge URLs when many teams are visible. */
const TEAM_IDS_IN_CHUNK = 120

/** Chunk size for `.in("id", …)` on users/profiles when resolving display names. */
const NAME_USER_IDS_CHUNK = 120

const TEAM_MEMBER_ROLES_FOR_HC = ["head_coach", "assistant_coach"] as const

function formatTeamLevel(level: string | null | undefined): string {
  if (level == null || String(level).trim() === "") return "Varsity"
  const l = String(level).toLowerCase()
  if (l === "varsity") return "Varsity"
  if (l === "jv") return "JV"
  if (l === "freshman") return "Freshman"
  return String(level)
}

export type AdTeamsTableAuthUser = {
  id: string
  role: string
  isPlatformOwner: boolean
  /** From session lite — skips duplicate profile read inside football/scope when set with directorDeptAsUser. */
  profileRoleDb?: string | null
  profileTeamId?: string | null
  profileSchoolId?: string | null
  /**
   * When defined (including null), `athletic_departments` row for this user as director was already loaded
   * on the route (shared with football + getAdPortalAccess).
   */
  directorDeptAsUser?: { id: string } | null
}

async function mapIdsInChunks<T>(
  ids: string[],
  chunkSize: number,
  run: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return []
  if (ids.length <= chunkSize) return run(ids)
  const out: T[] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(...(await run(ids.slice(i, i + chunkSize))))
  }
  return out
}

/**
 * Builds AD Teams table rows. Caller must enforce portal access (e.g. `canAccessAdPortalRoutes`) and
 * pass `adPortalAccess` from `getAdPortalAccessForUser` — do not call `buildAppAdPortalBootstrapPayload`
 * first (that duplicated the entire bootstrap + a second team list fetch).
 */
export async function loadAdTeamsTableData(
  supabase: SupabaseClient,
  user: AdTeamsTableAuthUser,
  adPortalAccess: AdPortalAccess,
  footballAccess: FootballAdAccessContext
): Promise<TeamRow[]> {
  const tRoute = performance.now()

  const scopePrefetch =
    user.directorDeptAsUser !== undefined
      ? {
          profile: {
            school_id: user.profileSchoolId ?? null,
            role: user.profileRoleDb ?? null,
          },
          deptAsDirector: user.directorDeptAsUser,
        }
      : undefined

  const tList = performance.now()
  const { scope, orFilter, teams: teamsData, error: teamsErr } = await fetchAdVisibleTeamsForAccess(
    supabase,
    user.id,
    adPortalAccess,
    { reuseFootballAccess: footballAccess, teamsSelectMode: "table", scopePrefetch }
  )
  adTeamsFlowPerfLog("loadAdTeamsTableData", "fetch_visible_teams", performance.now() - tList, {
    teamCount: teamsData?.length ?? 0,
  })

  const teams: TeamRow[] = []

  if (!orFilter) {
    logAdTeamVisibility("AdTeamsPage", {
      scope,
      sessionRole: user.role ?? null,
      teamCount: 0,
      teamIds: [],
      filter: null,
      queryError: "no_or_filter: missing school, department, and linked programs",
    })
    return teams
  }

  logAdTeamVisibility("AdTeamsPage", {
    scope,
    sessionRole: user.role ?? null,
    teamCount: teamsData?.length ?? 0,
    teamIds: (teamsData ?? []).map((t) => t.id),
    filter: orFilter,
    queryError: teamsErr ?? null,
  })

  if (!teamsData?.length) return teams

  const teamIds = teamsData.map((t) => t.id)
  const programIds = [
    ...new Set(
      teamsData.map((t) => t.program_id).filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ]
  const creatorIds = [
    ...new Set(
      teamsData
        .map((t) => t.created_by)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ]
  const now = new Date().toISOString()

  const tParallel = performance.now()
  const [staffRowsFlat, inviteRowsFlat, programsRes] = await Promise.all([
    (async () => {
      const t = performance.now()
      const rows = await mapIdsInChunks(teamIds, TEAM_IDS_IN_CHUNK, async (chunk) => {
        const { data } = await supabase
          .from("team_members")
          .select("team_id, user_id, role, is_primary")
          .in("team_id", chunk)
          .eq("active", true)
          .in("role", [...TEAM_MEMBER_ROLES_FOR_HC])
        return data ?? []
      })
      adTeamsFlowPerfLog("loadAdTeamsTableData", "team_members_staff_only", performance.now() - t, {
        teamCount: teamIds.length,
        rowCount: rows.length,
        chunks: Math.ceil(teamIds.length / TEAM_IDS_IN_CHUNK) || 1,
      })
      return rows
    })(),
    (async () => {
      const t = performance.now()
      const rows = await mapIdsInChunks(teamIds, TEAM_IDS_IN_CHUNK, async (chunk) => {
        const { data } = await supabase
          .from("invites")
          .select("team_id")
          .in("team_id", chunk)
          .is("accepted_at", null)
          .gt("expires_at", now)
        return data ?? []
      })
      adTeamsFlowPerfLog("loadAdTeamsTableData", "invites_pending", performance.now() - t, {
        teamCount: teamIds.length,
        rowCount: rows.length,
        chunks: Math.ceil(teamIds.length / TEAM_IDS_IN_CHUNK) || 1,
      })
      return rows
    })(),
    programIds.length > 0
      ? supabase.from("programs").select("id, sport").in("id", programIds)
      : Promise.resolve({ data: [] as { id: string; sport?: string | null }[] }),
  ])
  adTeamsFlowPerfLog("loadAdTeamsTableData", "parallel_batch_total", performance.now() - tParallel, {
    staffRows: staffRowsFlat.length,
    inviteRows: inviteRowsFlat.length,
  })

  const staffByTeam = new Map<string, TeamMemberStaffRow[]>()
  for (const row of staffRowsFlat) {
    const tid = (row as { team_id: string }).team_id
    const list = staffByTeam.get(tid) ?? []
    list.push({
      user_id: (row as { user_id: string }).user_id,
      role: (row as { role: string }).role,
      is_primary: (row as { is_primary?: boolean | null }).is_primary,
    })
    staffByTeam.set(tid, list)
  }

  const coachUserIds = new Set<string>()
  const headCoachUserIdByTeam = new Map<string, string | null>()
  for (const tid of teamIds) {
    const uid = pickHeadCoachUserId(staffByTeam.get(tid) ?? [])
    headCoachUserIdByTeam.set(tid, uid)
    if (uid) coachUserIds.add(uid)
  }

  const nameUserIds = [...new Set([...coachUserIds, ...creatorIds])]
  const tNamesParallel = performance.now()
  let usersRowsFlat: { id: string; name?: string | null }[] = []
  let profilesRowsFlat: { id: string; full_name?: string | null }[] = []
  if (nameUserIds.length > 0) {
    const pair = await Promise.all([
      mapIdsInChunks(nameUserIds, NAME_USER_IDS_CHUNK, async (chunk) => {
        const { data } = await supabase.from("users").select("id, name").in("id", chunk)
        return data ?? []
      }),
      mapIdsInChunks(nameUserIds, NAME_USER_IDS_CHUNK, async (chunk) => {
        const { data } = await supabase.from("profiles").select("id, full_name").in("id", chunk)
        return data ?? []
      }),
    ])
    usersRowsFlat = pair[0]
    profilesRowsFlat = pair[1]
  }
  adTeamsFlowPerfLog(
    "loadAdTeamsTableData",
    "users_and_profiles_names_parallel",
    performance.now() - tNamesParallel,
    { ids: nameUserIds.length }
  )

  const tPostFetch = performance.now()
  const usersById = new Map<string, { name?: string | null }>()
  for (const u of usersRowsFlat) {
    if (u?.id) usersById.set(u.id, u)
  }
  const profilesById = new Map<string, { full_name?: string | null }>()
  for (const p of profilesRowsFlat) {
    const id = (p as { id: string }).id
    if (id) profilesById.set(id, p as { full_name?: string | null })
  }

  const displayNameForUserId = (uid: string): string | null => {
    const fromUser = usersById.get(uid)?.name?.trim()
    if (fromUser && fromUser.length > 0) return fromUser
    const fromProfile = profilesById.get(uid)?.full_name?.trim()
    return fromProfile && fromProfile.length > 0 ? fromProfile : null
  }

  const creatorNameById = new Map<string, string>()
  for (const uid of creatorIds) {
    const nm = displayNameForUserId(uid)
    if (nm) creatorNameById.set(uid, nm)
  }

  const headCoachByTeam = new Map<string, string | null>()
  headCoachUserIdByTeam.forEach((userId, teamId) => {
    headCoachByTeam.set(teamId, userId ? displayNameForUserId(userId) : null)
  })

  const pendingTeamIds = new Set(
    inviteRowsFlat.map((i) => (i as { team_id: string }).team_id)
  )

  const sportByProgramId = new Map<string, string>()
  for (const p of programsRes.data ?? []) {
    if (p?.id) sportByProgramId.set(p.id, (p.sport as string) || "football")
  }
  adTeamsFlowPerfLog("loadAdTeamsTableData", "js_postfetch_maps", performance.now() - tPostFetch, {
    teamCount: teamIds.length,
  })

  const tBuildRows = performance.now()
  for (const t of teamsData) {
    const headCoachName = headCoachByTeam.get(t.id) ?? null
    const invitePending = pendingTeamIds.has(t.id)
    const programId = t.program_id as string | null | undefined
    const sportFromProgram = programId ? sportByProgramId.get(programId) : undefined
    const createdBy = t.created_by ?? null
    const genderRaw = (t as { gender?: string | null }).gender
    teams.push({
      id: t.id,
      name: t.name ?? "",
      sport: t.sport ?? sportFromProgram ?? null,
      genderLabel: genderRaw?.trim() ? String(genderRaw) : "—",
      levelLabel: formatTeamLevel(t.team_level),
      rosterSize: t.roster_size ?? null,
      headCoachName,
      creatorName: createdBy ? creatorNameById.get(createdBy) ?? null : null,
      createdAt: t.created_at ?? new Date().toISOString(),
      invitePending,
    })
  }
  adTeamsFlowPerfLog("loadAdTeamsTableData", "js_build_team_rows", performance.now() - tBuildRows, {
    rows: teams.length,
  })

  adTeamsFlowPerfLog("loadAdTeamsTableData", "total", performance.now() - tRoute, { rows: teams.length })
  return teams
}

/** Thin wrapper when callers do not already have `adPortalAccess` (e.g. tests). */
export async function loadAdTeamsPageRows(
  supabase: SupabaseClient,
  user: { id: string; email: string; role: string; isPlatformOwner: boolean }
): Promise<TeamRow[]> {
  const roleUpper = user.role.toUpperCase().replace(/ /g, "_")
  const footballAccess = await resolveFootballAdAccessState(supabase, user.id)
  if (!canAccessAdPortalRoutes(footballAccess)) {
    throw new Error("AD_BOOTSTRAP_FORBIDDEN")
  }
  const adPortalAccess = await getAdPortalAccessForUser(supabase, user.id, roleUpper)
  return loadAdTeamsTableData(supabase, user, adPortalAccess, footballAccess)
}
