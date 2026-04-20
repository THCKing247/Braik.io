import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdPortalAccess } from "@/lib/ad-portal-access"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import { adTeamsFlowPerfLog } from "@/lib/ad/ad-teams-table-perf"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { fetchAdVisibleTeamsForAccess, logAdTeamVisibility, type AdVisibleTeamRow } from "@/lib/ad-team-scope"
import {
  isAssistantCoachRole,
  isHeadCoachRole,
} from "@/lib/team-staff"
import {
  canAccessAdPortalRoutes,
  resolveFootballAdAccessState,
  type FootballAdAccessContext,
} from "@/lib/enforcement/football-ad-access"
import { resolveCanonicalTeamRouteByTeamId } from "@/lib/navigation/organization-routes"

/**
 * AD teams table architecture:
 * - `/dashboard/ad/teams` loads rows on the server (same as GET /api/ad/pages/teams-table) for first paint;
 *   React Query uses `/api/ad/pages/teams-table` for background refresh. AD shell bootstrap no longer embeds
 *   the full teams table (shell-only `includeTeamsTable=0`).
 */

/** React Query key for AD teams table — shared with visibility refresh invalidation. */
export const AD_TEAMS_TABLE_QUERY_KEY = ["ad-pages", "teams-table"] as const

/** PostgREST `.in("team_id", …)` chunk size to avoid huge URLs when many teams are visible. */
const TEAM_IDS_IN_CHUNK = 120

const PROFILE_IDS_CHUNK = 120

const TEAM_MEMBER_ROLES_COACH_DISPLAY = ["head_coach", "assistant_coach"] as const

type TeamMemberCoachRow = {
  team_id: string
  user_id: string
  role: string | null
  is_primary: boolean | null
}

function formatTeamLevel(level: string | null | undefined): string {
  if (level == null || String(level).trim() === "") return "Varsity"
  const l = String(level).toLowerCase()
  if (l === "varsity") return "Varsity"
  if (l === "jv") return "JV"
  if (l === "freshman") return "Freshman"
  return String(level)
}

/**
 * Picks one “display” coach per team from active head_coach / assistant_coach rows.
 * Prefer rows marked primary; if any primary exists, only those compete. Within the chosen pool,
 * head_coach wins over assistant_coach; otherwise the first matching assistant is used.
 */
function pickPreferredCoachUserId(rows: TeamMemberCoachRow[]): string | null {
  const coaches = rows.filter(
    (r) => r.user_id && (isHeadCoachRole(r.role) || isAssistantCoachRole(r.role))
  )
  if (coaches.length === 0) return null
  const primaries = coaches.filter((r) => r.is_primary === true)
  const pool = primaries.length > 0 ? primaries : coaches
  const head = pool.find((r) => isHeadCoachRole(r.role))
  if (head) return head.user_id
  const asst = pool.find((r) => isAssistantCoachRole(r.role))
  return asst?.user_id ?? null
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

async function fetchProfilesFullNameMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const unique = [...new Set(userIds.filter((id) => typeof id === "string" && id.length > 0))]
  const out = new Map<string, string | null>()
  if (unique.length === 0) return out

  const rows = await mapIdsInChunks<{ id: string; full_name: string | null }>(
    unique,
    PROFILE_IDS_CHUNK,
    async (chunk) => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", chunk)
      return data ?? []
    }
  )
  for (const row of rows) {
    if (!row?.id) continue
    const nm = row.full_name?.trim()
    out.set(row.id, nm && nm.length > 0 ? nm : null)
  }
  return out
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
  const creatorIds = [
    ...new Set(
      teamsData
        .map((t) => t.created_by)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ]
  const now = new Date().toISOString()

  const tParallel = performance.now()
  const [staffRowsFlat, inviteRowsFlat] = await Promise.all([
    (async () => {
      const t = performance.now()
      const rows = await mapIdsInChunks(teamIds, TEAM_IDS_IN_CHUNK, async (chunk) => {
        const { data } = await supabase
          .from("team_members")
          .select("team_id, user_id, role, is_primary")
          .in("team_id", chunk)
          .eq("active", true)
          .in("role", [...TEAM_MEMBER_ROLES_COACH_DISPLAY])
        return (data ?? []) as TeamMemberCoachRow[]
      })
      adTeamsFlowPerfLog("loadAdTeamsTableData", "team_members_coaches", performance.now() - t, {
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
  ])
  adTeamsFlowPerfLog("loadAdTeamsTableData", "parallel_batch_total", performance.now() - tParallel, {
    staffRows: staffRowsFlat.length,
    inviteRows: inviteRowsFlat.length,
  })

  const coachesByTeam = new Map<string, TeamMemberCoachRow[]>()
  for (const row of staffRowsFlat) {
    const tid = row.team_id
    const list = coachesByTeam.get(tid) ?? []
    list.push(row)
    coachesByTeam.set(tid, list)
  }

  const headCoachUserIdByTeam = new Map<string, string | null>()
  for (const t of teamsData) {
    headCoachUserIdByTeam.set(t.id, pickPreferredCoachUserId(coachesByTeam.get(t.id) ?? []))
  }

  const nameUserIds = [
    ...new Set(
      [...headCoachUserIdByTeam.values(), ...creatorIds].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    ),
  ]
  const tProfiles = performance.now()
  const displayNameByUserId = await fetchProfilesFullNameMap(supabase, nameUserIds)
  adTeamsFlowPerfLog("loadAdTeamsTableData", "profiles_full_names", performance.now() - tProfiles, {
    ids: nameUserIds.length,
  })

  const tPostFetch = performance.now()

  const creatorNameById = new Map<string, string>()
  for (const uid of creatorIds) {
    const nm = displayNameByUserId.get(uid) ?? null
    if (nm) creatorNameById.set(uid, nm)
  }

  const headCoachByTeam = new Map<string, string | null>()
  headCoachUserIdByTeam.forEach((userId, teamId) => {
    headCoachByTeam.set(teamId, userId ? displayNameByUserId.get(userId) ?? null : null)
  })

  const pendingTeamIds = new Set(inviteRowsFlat.map((i) => (i as { team_id: string }).team_id))

  adTeamsFlowPerfLog("loadAdTeamsTableData", "js_postfetch_maps", performance.now() - tPostFetch, {
    teamCount: teamIds.length,
  })

  const tBuildRows = performance.now()
  const canonicalByTeamId = new Map<string, { organizationPortalUuid: string; shortTeamId: string }>()
  await Promise.all(
    teamsData.map(async (team) => {
      const resolved = await resolveCanonicalTeamRouteByTeamId(supabase, team.id)
      if (resolved) canonicalByTeamId.set(team.id, resolved)
    })
  )
  for (const t of teamsData) {
    const row = t as AdVisibleTeamRow
    const headCoachName = headCoachByTeam.get(t.id) ?? null
    const invitePending = pendingTeamIds.has(t.id)
    const createdBy = t.created_by ?? null
    const genderRaw = row.gender
    teams.push({
      id: t.id,
      organizationPortalUuid: canonicalByTeamId.get(t.id)?.organizationPortalUuid ?? null,
      shortTeamId: canonicalByTeamId.get(t.id)?.shortTeamId ?? null,
      name: t.name ?? "",
      sport: t.sport ?? null,
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
