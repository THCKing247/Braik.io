import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdPortalAccess } from "@/lib/ad-portal-access"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { fetchAdVisibleTeamsForAccess, logAdTeamVisibility } from "@/lib/ad-team-scope"
import { pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"
import {
  canAccessAdPortalRoutes,
  resolveFootballAdAccessState,
  type FootballAdAccessContext,
} from "@/lib/enforcement/football-ad-access"

/** React Query key for AD teams table — shared with visibility refresh invalidation. */
export const AD_TEAMS_TABLE_QUERY_KEY = ["ad-pages", "teams-table"] as const

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
}

const shouldLogAdTeamsPerf =
  process.env.NODE_ENV === "development" || process.env.AD_TEAMS_TABLE_PERF === "1"

function perfLog(phase: string, ms: number, extra?: Record<string, unknown>) {
  if (!shouldLogAdTeamsPerf) return
  console.info(`[ad-teams-table-perf] ${phase}`, { ms: Math.round(ms * 10) / 10, ...extra })
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

  const { scope, orFilter, teams: teamsData, error: teamsErr } = await fetchAdVisibleTeamsForAccess(
    supabase,
    user.id,
    adPortalAccess,
    { reuseFootballAccess: footballAccess }
  )
  perfLog("teams_list", performance.now() - tRoute, { teamCount: teamsData?.length ?? 0 })

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
  const [staffRes, invitesRes, programsRes] = await Promise.all([
    supabase
      .from("team_members")
      .select("team_id, user_id, role, is_primary")
      .in("team_id", teamIds)
      .eq("active", true),
    supabase
      .from("invites")
      .select("team_id")
      .in("team_id", teamIds)
      .is("accepted_at", null)
      .gt("expires_at", now),
    programIds.length > 0
      ? supabase.from("programs").select("id, sport").in("id", programIds)
      : Promise.resolve({ data: [] as { id: string; sport?: string | null }[] }),
  ])
  perfLog("parallel_staff_invites_programs", performance.now() - tParallel, {
    staffRows: staffRes.data?.length ?? 0,
  })

  const staffByTeam = new Map<string, TeamMemberStaffRow[]>()
  for (const row of staffRes.data ?? []) {
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
  const tUsers = performance.now()
  let usersRows: { id: string; name?: string | null }[] = []
  if (nameUserIds.length > 0) {
    const { data } = await supabase.from("users").select("id, name").in("id", nameUserIds)
    usersRows = data ?? []
  }
  perfLog("users_names", performance.now() - tUsers, { ids: nameUserIds.length })

  const usersById = new Map<string, { name?: string | null }>()
  for (const u of usersRows) {
    if (u?.id) usersById.set(u.id, u)
  }

  const creatorNameById = new Map<string, string>()
  for (const uid of creatorIds) {
    const nm = usersById.get(uid)?.name?.trim()
    if (nm) creatorNameById.set(uid, nm)
  }

  const missingProfileIds = creatorIds.filter((id) => !creatorNameById.has(id))
  const tProf = performance.now()
  if (missingProfileIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", missingProfileIds)
    for (const p of profs ?? []) {
      const pid = (p as { id: string }).id
      const fn = (p as { full_name?: string | null }).full_name?.trim()
      if (pid && fn && !creatorNameById.has(pid)) creatorNameById.set(pid, fn)
    }
  }
  perfLog("profiles_fallback", performance.now() - tProf, { missing: missingProfileIds.length })

  const headCoachByTeam = new Map<string, string | null>()
  headCoachUserIdByTeam.forEach((userId, teamId) => {
    if (!userId) {
      headCoachByTeam.set(teamId, null)
      return
    }
    const u = usersById.get(userId)
    const name = u?.name?.trim() ?? null
    headCoachByTeam.set(teamId, name && name.length > 0 ? name : null)
  })

  const pendingTeamIds = new Set((invitesRes.data ?? []).map((i) => (i as { team_id: string }).team_id))

  const sportByProgramId = new Map<string, string>()
  for (const p of programsRes.data ?? []) {
    if (p?.id) sportByProgramId.set(p.id, (p.sport as string) || "football")
  }

  teamsData.forEach((t) => {
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
  })

  perfLog("total_loadAdTeamsTableData", performance.now() - tRoute, { rows: teams.length })
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
