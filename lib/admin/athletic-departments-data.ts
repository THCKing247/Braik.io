import type { SupabaseClient } from "@supabase/supabase-js"
import {
  collectAssociatedUserIdsForAthleticDepartment,
  collectTeamIdsForAthleticDepartment,
  countActiveTeams,
  countAssistantCoachesOnTeams,
  loadStaffRowsForTeams,
  pickHeadCoachUserId,
  isAssistantCoachRole,
  resolveAthleticDepartmentIdForTeam,
} from "@/lib/admin/athletic-departments-scope"
import type {
  AthleticDepartmentDetailOverview,
  AthleticDepartmentListRow,
  AthleticDepartmentTeamRow,
  AthleticDepartmentUserRow,
} from "@/lib/admin/athletic-departments-types"

type TeamRow = {
  id: string
  name: string | null
  program_id: string | null
  athletic_department_id: string | null
  team_status: string | null
  sport: string | null
  team_level: string | null
  video_clips_enabled: boolean | null
}

type OrgRow = { id: string; athletic_department_id: string | null; name: string | null }
type ProgramRow = { id: string; organization_id: string | null }

/** In-memory index: resolved AD id → team ids (for batch list aggregation). */
export async function buildResolvedAdTeamIndex(supabase: SupabaseClient): Promise<{
  teamIdsByAd: Map<string, string[]>
  teamRowById: Map<string, TeamRow & { resolvedAthleticDepartmentId: string | null }>
  orgById: Map<string, OrgRow>
  programById: Map<string, ProgramRow>
}> {
  const { data: teamsRaw } = await supabase
    .from("teams")
    .select(
      "id, name, program_id, athletic_department_id, team_status, sport, team_level, video_clips_enabled"
    )
  const { data: programsRaw } = await supabase.from("programs").select("id, organization_id")
  const { data: orgsRaw } = await supabase.from("organizations").select("id, athletic_department_id, name")

  const orgById = new Map<string, OrgRow>()
  for (const o of orgsRaw ?? []) {
    const r = o as OrgRow
    orgById.set(r.id, r)
  }
  const programById = new Map<string, ProgramRow>()
  for (const p of programsRaw ?? []) {
    const r = p as ProgramRow
    programById.set(r.id, r)
  }

  const teamIdsByAd = new Map<string, Set<string>>()
  const teamRowById = new Map<string, TeamRow & { resolvedAthleticDepartmentId: string | null }>()

  function addTeamToAd(adId: string, teamId: string) {
    const s = teamIdsByAd.get(adId) ?? new Set()
    s.add(teamId)
    teamIdsByAd.set(adId, s)
  }

  for (const t of teamsRaw ?? []) {
    const tr = t as TeamRow
    let orgAd: string | null = null
    if (tr.program_id) {
      const pr = programById.get(tr.program_id)
      const oid = pr?.organization_id
      if (oid) {
        orgAd = orgById.get(oid)?.athletic_department_id ?? null
      }
    }
    const resolved = resolveAthleticDepartmentIdForTeam({
      teamAthleticDepartmentId: tr.athletic_department_id,
      organizationAthleticDepartmentId: orgAd,
    })
    teamRowById.set(tr.id, { ...tr, resolvedAthleticDepartmentId: resolved })
    if (resolved) addTeamToAd(resolved, tr.id)
  }

  const asArrays = new Map<string, string[]>()
  for (const [adId, set] of teamIdsByAd) {
    asArrays.set(adId, [...set])
  }
  return { teamIdsByAd: asArrays, teamRowById, orgById, programById }
}

async function countUsersForAdBatch(
  supabase: SupabaseClient,
  athleticDepartmentId: string,
  teamIds: string[]
): Promise<number> {
  const set = await collectAssociatedUserIdsForAthleticDepartment(supabase, athleticDepartmentId, teamIds)
  return set.size
}

export async function loadAthleticDepartmentsListRows(supabase: SupabaseClient): Promise<AthleticDepartmentListRow[]> {
  const { data: ads, error } = await supabase
    .from("athletic_departments")
    .select(
      "id, school_id, status, teams_allowed, assistant_coaches_allowed, video_clips_enabled, coach_b_plus_enabled"
    )
    .order("created_at", { ascending: false })
  if (error) throw error

  const schoolIds = [...new Set((ads ?? []).map((a) => (a as { school_id: string }).school_id))]
  const { data: schools } =
    schoolIds.length > 0
      ? await supabase.from("schools").select("id, name").in("id", schoolIds)
      : { data: [] as { id: string; name: string }[] }
  const schoolNameById = new Map((schools ?? []).map((s) => [(s as { id: string; name: string }).id, (s as { name: string }).name]))

  const { teamIdsByAd } = await buildResolvedAdTeamIndex(supabase)

  const { data: allOrgs } = await supabase.from("organizations").select("id, name, athletic_department_id")
  const orgNamesByAd = new Map<string, string[]>()
  for (const o of allOrgs ?? []) {
    const r = o as { athletic_department_id?: string | null; name?: string | null }
    if (!r.athletic_department_id || !r.name?.trim()) continue
    const list = orgNamesByAd.get(r.athletic_department_id) ?? []
    list.push(r.name.trim())
    orgNamesByAd.set(r.athletic_department_id, list)
  }

  const rows: AthleticDepartmentListRow[] = []
  for (const raw of ads ?? []) {
    const a = raw as {
      id: string
      status: string
      teams_allowed: number
      assistant_coaches_allowed: number
      video_clips_enabled: boolean
      coach_b_plus_enabled?: boolean
      school_id: string
    }
    const teamIds = teamIdsByAd.get(a.id) ?? []
    const orgNames = (orgNamesByAd.get(a.id) ?? []).filter(Boolean)
    const orgSummary = orgNames.length === 0 ? null : orgNames.slice(0, 3).join(", ") + (orgNames.length > 3 ? "…" : "")

    const totalUsers = await countUsersForAdBatch(supabase, a.id, teamIds)

    rows.push({
      id: a.id,
      schoolName: schoolNameById.get(a.school_id) ?? "(unknown school)",
      organizationSummary: orgSummary,
      teamCount: teamIds.length,
      teamsAllowed: a.teams_allowed,
      assistantCoachesAllowed: a.assistant_coaches_allowed,
      videoFeatureEnabled: Boolean(a.video_clips_enabled),
      coachBPlusFeatureEnabled: Boolean(a.coach_b_plus_enabled),
      totalUsers,
      status: a.status,
    })
  }

  return rows
}

export async function loadAthleticDepartmentDetail(
  supabase: SupabaseClient,
  athleticDepartmentId: string
): Promise<{
  overview: AthleticDepartmentDetailOverview
  teams: AthleticDepartmentTeamRow[]
  users: AthleticDepartmentUserRow[]
} | null> {
  const { data: ad, error } = await supabase
    .from("athletic_departments")
    .select(
      "id, school_id, status, teams_allowed, assistant_coaches_allowed, video_clips_enabled, coach_b_plus_enabled, athletic_director_user_id"
    )
    .eq("id", athleticDepartmentId)
    .maybeSingle()
  if (error) throw error
  if (!ad) return null

  const schoolId = (ad as { school_id: string }).school_id
  const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle()
  const schoolName = (school as { name?: string } | null)?.name ?? "(unknown school)"

  const { data: orgs } = await supabase
    .from("organizations")
    .select("name")
    .eq("athletic_department_id", athleticDepartmentId)
  const organizationNames = (orgs ?? [])
    .map((o) => (o as { name?: string }).name?.trim())
    .filter((n): n is string => Boolean(n))

  const teamIds = await collectTeamIdsForAthleticDepartment(supabase, athleticDepartmentId)
  const activeTeamCount = await countActiveTeams(teamIds, supabase)
  const assistantCoachUsageCount = await countAssistantCoachesOnTeams(supabase, teamIds)

  const staffByTeam = await loadStaffRowsForTeams(supabase, teamIds)
  const headIds = new Set<string>()
  for (const tid of teamIds) {
    const uid = pickHeadCoachUserId(staffByTeam.get(tid) ?? [])
    if (uid) headIds.add(uid)
  }
  const { data: teamRows } =
    teamIds.length > 0
      ? await supabase
          .from("teams")
          .select(
            "id, name, sport, team_level, team_status, video_clips_enabled, coach_b_plus_enabled, program_id, athletic_department_id"
          )
          .in("id", teamIds)
      : { data: [] }

  const adVideo = Boolean((ad as { video_clips_enabled?: boolean }).video_clips_enabled)
  const adCoachBPlus = Boolean((ad as { coach_b_plus_enabled?: boolean }).coach_b_plus_enabled)

  const programIds = [
    ...new Set(
      (teamRows ?? [])
        .map((t) => (t as { program_id?: string | null }).program_id)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    ),
  ]
  const orgVideoByProgramId = new Map<string, boolean | null>()
  const orgCoachBPlusByProgramId = new Map<string, boolean | null>()
  if (programIds.length > 0) {
    const { data: programs } = await supabase.from("programs").select("id, organization_id").in("id", programIds)
    const orgIds = [
      ...new Set(
        (programs ?? [])
          .map((p) => (p as { organization_id?: string | null }).organization_id)
          .filter((x): x is string => typeof x === "string" && x.length > 0)
      ),
    ]
    const orgVideoByOrgId = new Map<string, boolean>()
    const orgCoachBPlusByOrgId = new Map<string, boolean>()
    if (orgIds.length > 0) {
      const { data: orgRows } = await supabase
        .from("organizations")
        .select("id, video_clips_enabled, coach_b_plus_enabled")
        .in("id", orgIds)
      for (const o of orgRows ?? []) {
        const row = o as { id: string; video_clips_enabled?: boolean; coach_b_plus_enabled?: boolean }
        orgVideoByOrgId.set(row.id, Boolean(row.video_clips_enabled))
        orgCoachBPlusByOrgId.set(row.id, Boolean(row.coach_b_plus_enabled))
      }
    }
    for (const p of programs ?? []) {
      const pr = p as { id: string; organization_id?: string | null }
      const v =
        pr.organization_id != null ? orgVideoByOrgId.get(pr.organization_id) : undefined
      orgVideoByProgramId.set(pr.id, v === undefined ? null : v)
      const cb =
        pr.organization_id != null ? orgCoachBPlusByOrgId.get(pr.organization_id) : undefined
      orgCoachBPlusByProgramId.set(pr.id, cb === undefined ? null : cb)
    }
  }

  const hcNameById = new Map<string, string>()
  if (headIds.size > 0) {
    const { data: hcUsers } = await supabase.from("users").select("id, name").in("id", [...headIds])
    for (const u of hcUsers ?? []) {
      hcNameById.set((u as { id: string }).id, (u as { name?: string | null }).name?.trim() || "")
    }
  }

  const teams: AthleticDepartmentTeamRow[] = (teamRows ?? []).map((t) => {
    const tr = t as {
      id: string
      name?: string | null
      sport?: string | null
      team_level?: string | null
      team_status?: string | null
      video_clips_enabled?: boolean | null
    }
    const staff = staffByTeam.get(tr.id) ?? []
    const hcUid = pickHeadCoachUserId(staff)
    const hcName = hcUid ? hcNameById.get(hcUid) || null : null
    const assistantCoachCount = staff.filter((m) => isAssistantCoachRole(m.role)).length
    const teamVid = Boolean(tr.video_clips_enabled)
    const pid = (tr as { program_id?: string | null }).program_id
    const orgVid = pid ? orgVideoByProgramId.get(pid) ?? null : null
    const orgOk = orgVid == null ? true : orgVid
    const teamCoachB = Boolean((tr as { coach_b_plus_enabled?: boolean }).coach_b_plus_enabled)
    const orgCoachB = pid ? orgCoachBPlusByProgramId.get(pid) ?? null : null
    const orgOkCoachB = orgCoachB == null ? true : orgCoachB
    return {
      id: tr.id,
      name: tr.name ?? "",
      sport: tr.sport ?? null,
      level: tr.team_level ?? null,
      headCoachName: hcName,
      assistantCoachCount,
      teamStatus: tr.team_status ?? "active",
      videoFeatureEnabled: teamVid,
      organizationVideoEnabled: orgVid,
      videoEffectiveEnabled: Boolean(adVideo && orgOk && teamVid),
      coachBPlusFeatureEnabled: teamCoachB,
      organizationCoachBPlusEnabled: orgCoachB,
      coachBPlusEffectiveEnabled: Boolean(adCoachBPlus && orgOkCoachB && teamCoachB),
    }
  })

  teams.sort((a, b) => a.name.localeCompare(b.name))

  const userIds = await collectAssociatedUserIdsForAthleticDepartment(supabase, athleticDepartmentId, teamIds)
  const userIdList = [...userIds]

  const users: AthleticDepartmentUserRow[] = []
  if (userIdList.length > 0) {
    const { data: userRows } = await supabase
      .from("users")
      .select("id, email, name, role, status, last_login_at")
      .in("id", userIdList)
    const { data: profiles } = await supabase.from("profiles").select("id, role").in("id", userIdList)

    const profileRole = new Map<string, string>()
    for (const p of profiles ?? []) {
      profileRole.set((p as { id: string }).id, String((p as { role?: string }).role ?? ""))
    }

    const teamLabelByUser = new Map<string, string[]>()
    const { data: tm } = await supabase
      .from("team_members")
      .select("user_id, team_id, active")
      .in("user_id", userIdList)
      .in("team_id", teamIds)
      .eq("active", true)
    const teamNameById = new Map<string, string>()
    for (const tr of teamRows ?? []) {
      const row = tr as { id: string; name?: string | null }
      teamNameById.set(row.id, row.name?.trim() || "Team")
    }

    for (const row of tm ?? []) {
      const uid = (row as { user_id: string }).user_id
      const tid = (row as { team_id: string }).team_id
      const label = teamNameById.get(tid) ?? tid
      const list = teamLabelByUser.get(uid) ?? []
      if (!list.includes(label)) list.push(label)
      teamLabelByUser.set(uid, list)
    }

    for (const u of userRows ?? []) {
      const ur = u as {
        id: string
        email?: string | null
        name?: string | null
        role?: string | null
        status?: string | null
        last_login_at?: string | null
      }
      const pr = profileRole.get(ur.id)?.trim()
      const roleDisplay = pr || ur.role || "member"
      const labels = teamLabelByUser.get(ur.id)?.join(", ") ?? "—"
      users.push({
        id: ur.id,
        name: ur.name ?? null,
        email: ur.email ?? null,
        role: roleDisplay,
        teamLabels: labels,
        status: ur.status ?? "active",
        lastLoginAt: ur.last_login_at ?? null,
      })
    }
    users.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
  }

  const overview: AthleticDepartmentDetailOverview = {
    id: athleticDepartmentId,
    schoolName,
    schoolId,
    teamsAllowed: (ad as { teams_allowed: number }).teams_allowed,
    assistantCoachesAllowed: (ad as { assistant_coaches_allowed: number }).assistant_coaches_allowed,
    videoFeatureEnabled: adVideo,
    coachBPlusFeatureEnabled: adCoachBPlus,
    activeTeamCount,
    assistantCoachUsageCount,
    organizationNames,
  }

  return { overview, teams, users }
}
