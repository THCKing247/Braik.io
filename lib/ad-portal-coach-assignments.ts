import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAdPortalVisibleTeams, type AthleticDirectorScope } from "@/lib/ad-team-scope"
import { pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

/** Team-level head coach slot (one row per AD-visible team). */
export type AdHeadCoachAssignmentRow = {
  teamId: string
  teamName: string
  userId: string | null
  fullName: string | null
  email: string | null
}

/** Team-level assistant coach memberships (not program_roles). */
export type AdAssistantCoachAssignmentRow = {
  teamId: string
  teamName: string
  userId: string
  fullName: string | null
  email: string | null
}

export type AdCoachAssignmentsPicklistTeam = { id: string; name: string; programId: string | null }

export type AdCoachAssignmentsPageData = {
  headRows: AdHeadCoachAssignmentRow[]
  assistantRows: AdAssistantCoachAssignmentRow[]
  teamsPicklist: AdCoachAssignmentsPicklistTeam[]
  scope: AthleticDirectorScope
  orFilter: string | null
  teamsQueryError: string | null
}

/**
 * Coaches tab data: `team_members` only (primary head per visible team + assistants).
 * Does not use `program_members` for display or control.
 */
export async function fetchAdCoachAssignmentsPageData(
  supabase: SupabaseClient,
  sessionUserId: string
): Promise<AdCoachAssignmentsPageData> {
  const { scope, orFilter, teams: teamRows, error: teamsErr } = await fetchAdPortalVisibleTeams(
    supabase,
    sessionUserId
  )

  if (!orFilter || teamsErr || !teamRows?.length) {
    return {
      headRows: [],
      assistantRows: [],
      teamsPicklist: [],
      scope,
      orFilter,
      teamsQueryError: teamsErr,
    }
  }

  const visibleTeamIds = teamRows.map((t) => t.id)
  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name ?? ""]))

  const teamsPicklist: AdCoachAssignmentsPicklistTeam[] = teamRows.map((t) => ({
    id: t.id,
    name: t.name ?? "—",
    programId: (t.program_id as string | null | undefined) ?? null,
  }))

  const { data: headMemberRows } = await supabase
    .from("team_members")
    .select("team_id, user_id, role, is_primary")
    .in("team_id", visibleTeamIds)
    .eq("active", true)

  const staffByTeam = new Map<string, TeamMemberStaffRow[]>()
  for (const row of headMemberRows ?? []) {
    const r = row as { team_id: string; user_id: string; role: string; is_primary?: boolean | null }
    const role = (r.role ?? "").toLowerCase()
    if (role !== "head_coach") continue
    const list = staffByTeam.get(r.team_id) ?? []
    list.push({ user_id: r.user_id, role: r.role, is_primary: r.is_primary })
    staffByTeam.set(r.team_id, list)
  }

  const headUserIds = new Set<string>()
  const headRows: AdHeadCoachAssignmentRow[] = visibleTeamIds.map((teamId) => {
    const uid = pickHeadCoachUserId(staffByTeam.get(teamId) ?? [])
    if (uid) headUserIds.add(uid)
    return {
      teamId,
      teamName: teamNameById.get(teamId) ?? "—",
      userId: uid,
      fullName: null,
      email: null,
    }
  })

  const { data: asstMemberRows } = await supabase
    .from("team_members")
    .select("team_id, user_id, role")
    .in("team_id", visibleTeamIds)
    .eq("active", true)
    .eq("role", "assistant_coach")

  const assistantPairs = (asstMemberRows ?? []) as { team_id: string; user_id: string }[]
  const asstUserIds = new Set(assistantPairs.map((r) => r.user_id))

  const profileIds = [...new Set([...headUserIds, ...asstUserIds])]
  const profileByUserId = new Map<string, { full_name: string | null; email: string | null }>()
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds)
    for (const p of profiles ?? []) {
      const row = p as { id: string; full_name: string | null; email: string | null }
      profileByUserId.set(row.id, { full_name: row.full_name, email: row.email })
    }
  }

  for (const row of headRows) {
    if (!row.userId) continue
    const prof = profileByUserId.get(row.userId)
    row.fullName = prof?.full_name ?? null
    row.email = prof?.email ?? null
  }

  const assistantRows: AdAssistantCoachAssignmentRow[] = assistantPairs.map((r) => {
    const prof = profileByUserId.get(r.user_id)
    return {
      teamId: r.team_id,
      teamName: teamNameById.get(r.team_id) ?? "—",
      userId: r.user_id,
      fullName: prof?.full_name ?? null,
      email: prof?.email ?? null,
    }
  })

  assistantRows.sort((a, b) => {
    const t = a.teamName.localeCompare(b.teamName, undefined, { sensitivity: "base" })
    if (t !== 0) return t
    const n = (a.fullName || a.email || "").localeCompare(b.fullName || b.email || "", undefined, {
      sensitivity: "base",
    })
    return n
  })

  return {
    headRows,
    assistantRows,
    teamsPicklist,
    scope,
    orFilter,
    teamsQueryError: null,
  }
}

/** Verify team id is in AD portal visible set for this user. */
export async function assertTeamInAdPortalScope(
  supabase: SupabaseClient,
  sessionUserId: string,
  teamId: string
): Promise<boolean> {
  const { teams } = await fetchAdPortalVisibleTeams(supabase, sessionUserId)
  return teams.some((t) => t.id === teamId)
}

export function programIdForTeamInPicklist(
  teamsPicklist: AdCoachAssignmentsPicklistTeam[],
  teamId: string
): string | null {
  return teamsPicklist.find((t) => t.id === teamId)?.programId ?? null
}
