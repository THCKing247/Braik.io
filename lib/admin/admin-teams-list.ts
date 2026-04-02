import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseProjectUrl } from "@/src/lib/supabase-project-env"
import { isAssistantCoachRole, isHeadCoachRole, pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"
import { displayOrganizationName } from "@/lib/teams/team-organization-name"

/** Escape `%`, `_`, and `\` for use inside PostgREST `ilike` patterns (SQL LIKE semantics). */
export function escapeIlikePatternFragment(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

export type AdminTeamListRow = {
  id: string
  name: string
  planTier: string | null
  subscriptionStatus: string
  teamStatus: string
  organization: { name: string }
  players: Array<{ id: string }>
  headCoachName: string | null
  coachStaffCount: number
}

function redactedSupabaseHost(): string {
  const url = getSupabaseProjectUrl()
  if (!url) return "(unset)"
  try {
    return new URL(url).host
  } catch {
    return "(invalid URL)"
  }
}

const DEBUG = process.env.BRAIK_DEBUG_ADMIN_TEAMS === "1"

/** programs → organizations(name); optional embed (left join). */
const TEAMS_SELECT_WITH_ORG_EMBED =
  "id, name, plan_tier, subscription_status, team_status, program_id, created_at, programs(organizations(name))"
const TEAMS_SELECT_NO_EMBED =
  "id, name, plan_tier, subscription_status, team_status, program_id, created_at"
const TEAMS_SELECT_MINIMAL = "id, name, program_id, created_at"

type TeamsTableListRow = {
  id: string
  name: string
  plan_tier?: string | null
  subscription_status?: string | null
  team_status?: string | null
  program_id?: string | null
  created_at?: string | null
  programs?: unknown
}

/**
 * Super Admin teams list: service-role client, no org scoping.
 * Organization label comes from programs → organizations, not teams.org.
 */
export async function fetchSuperAdminTeamsList(
  supabase: SupabaseClient,
  opts: { q: string; filterUserId: string | null; limit?: number }
): Promise<{ teams: AdminTeamListRow[]; error: string | null }> {
  const limit = opts.limit ?? 200
  const q = opts.q.trim()
  const filterUserId = opts.filterUserId?.trim() || null

  if (DEBUG) {
    console.info("[admin/teams][debug] inputs", {
      q: q || null,
      filterUserId,
      supabaseHost: redactedSupabaseHost(),
      limit,
    })
  }

  let teamIds: string[] | null = null
  if (filterUserId) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", filterUserId)
      .maybeSingle()
    if (profileErr) {
      console.warn("[admin/teams] profiles lookup failed:", profileErr.message)
      return { teams: [], error: `Could not load user profile: ${profileErr.message}` }
    }
    teamIds = profile?.team_id ? [profile.team_id] : []
    if (teamIds.length === 0) {
      return { teams: [], error: null }
    }
  }

  function buildTeamsQuery(selectList: string) {
    let req = supabase
      .from("teams")
      .select(selectList)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (teamIds) req = req.in("id", teamIds)
    if (q) {
      const esc = escapeIlikePatternFragment(q)
      req = req.ilike("name", `%${esc}%`)
    }
    return req
  }

  const cascade = [TEAMS_SELECT_WITH_ORG_EMBED, TEAMS_SELECT_NO_EMBED, TEAMS_SELECT_MINIMAL] as const
  let rows: unknown[] | null = null
  let lastError: { message: string } | null = null
  let usedSelect: string | null = null

  for (const selectList of cascade) {
    const { data, error } = await buildTeamsQuery(selectList)
    if (error) {
      console.warn(`[admin/teams] teams query failed [${selectList.slice(0, 48)}…]:`, error.message)
      lastError = error
      continue
    }
    rows = data ?? []
    usedSelect = selectList
    break
  }

  if (rows === null) {
    const msg = lastError?.message ?? "Unknown error loading teams"
    return { teams: [], error: msg }
  }

  if (DEBUG) {
    console.info("[admin/teams][debug] result", {
      teamsReturned: rows.length,
      usedSelectPrefix: usedSelect?.slice(0, 80) ?? null,
    })
  }

  const teamRows = rows as unknown as TeamsTableListRow[]
  const teamIdList = teamRows.map((t) => t.id)

  const { data: staffRows, error: staffErr } =
    teamIdList.length > 0
      ? await supabase
          .from("team_members")
          .select("team_id, user_id, role, is_primary")
          .in("team_id", teamIdList)
          .eq("active", true)
      : { data: [] as Record<string, unknown>[], error: null }

  if (staffErr) {
    console.warn("[admin/teams] team_members query failed:", staffErr.message)
  }

  const staffByTeam = new Map<string, TeamMemberStaffRow[]>()
  for (const row of staffRows ?? []) {
    const tid = row.team_id as string
    const list = staffByTeam.get(tid) ?? []
    list.push({
      user_id: row.user_id as string,
      role: row.role as string,
      is_primary: row.is_primary as boolean | null | undefined,
    })
    staffByTeam.set(tid, list)
  }

  const headCoachIds = new Set<string>()
  for (const tid of teamIdList) {
    const uid = pickHeadCoachUserId(staffByTeam.get(tid) ?? [])
    if (uid) headCoachIds.add(uid)
  }

  const { data: hcUsers, error: hcErr } =
    headCoachIds.size > 0
      ? await supabase.from("users").select("id, name").in("id", [...headCoachIds])
      : { data: [] as { id: string; name: string | null }[], error: null }

  if (hcErr) {
    console.warn("[admin/teams] users (head coaches) query failed:", hcErr.message)
  }

  const hcNameById = new Map((hcUsers ?? []).map((u) => [u.id, u.name?.trim() || null]))

  const teams: AdminTeamListRow[] = teamRows.map((row) => {
    const staff = staffByTeam.get(row.id) ?? []
    const hcUid = pickHeadCoachUserId(staff)
    const headCoachName =
      hcUid && (hcNameById.get(hcUid) ?? "")?.length ? (hcNameById.get(hcUid) as string) : null
    const coachStaffCount = staff.filter(
      (m) => isHeadCoachRole(m.role) || isAssistantCoachRole(m.role)
    ).length
    return {
      id: row.id,
      name: row.name,
      planTier: row.plan_tier ?? null,
      subscriptionStatus: row.subscription_status ?? "active",
      teamStatus: row.team_status ?? "active",
      organization: { name: displayOrganizationName(row) },
      players: [],
      headCoachName,
      coachStaffCount,
    }
  })

  return { teams, error: null }
}
