import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { isAssistantCoachRole, isHeadCoachRole, pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

export type OwnershipSource =
  | "team_organization_id"
  | "program_organization_id"
  /** Unique org linked to this AD on organizations.athletic_department_id */
  | "organization_athletic_department"
  /** Unique org linked to this school on organizations.school_id */
  | "organization_school"
  | "unassigned"

export type AdminTeamRow = {
  id: string
  name: string
  planTier: string | null
  subscriptionStatus: string
  teamStatus: string
  organization: { id: string | null; name: string }
  ownershipSource: OwnershipSource
  /** Secondary context only (school / dept / program without org); not primary grouping. */
  legacyContext: string | null
  sport: string | null
  teamLevel: string | null
  createdAt: string
  players: Array<{ id: string }>
  headCoachName: string | null
  coachStaffCount: number
}

/** Every organization row from the DB with how many teams resolve to it (canonical ownership). */
export type AdminOrganizationDirectoryRow = {
  id: string
  name: string
  teamCount: number
}

export type AdminTeamGroup = {
  groupKey: string
  groupTitle: string
  groupHint: string | null
  teams: AdminTeamRow[]
}

type OrgRow = {
  id: string
  name: string | null
  school_id: string | null
  athletic_department_id: string | null
}

type ProgramRow = {
  id: string
  program_name: string | null
  sport: string | null
  organization_id: string | null
}

type SchoolRow = { id: string; name: string | null }
type AdRow = { id: string; school_id: string | null }

function emptyDirectory(rows: OrgRow[]): AdminOrganizationDirectoryRow[] {
  return rows.map((o) => ({
    id: o.id,
    name: (o.name ?? "").trim() || "—",
    teamCount: 0,
  }))
}

export async function loadAdminTeamsGrouped(params: {
  query?: string
  filterUserId?: string | null
}): Promise<{
  groups: AdminTeamGroup[]
  organizationDirectory: AdminOrganizationDirectoryRow[]
  filterUserId: string | null
}> {
  const q = params.query?.trim() || ""
  const filterUserId = params.filterUserId?.trim() || null

  const fallback = {
    groups: [] as AdminTeamGroup[],
    organizationDirectory: [] as AdminOrganizationDirectoryRow[],
    filterUserId,
  }

  return safeAdminDbQuery(async () => {
    console.info("[admin] loadAdminTeamsGrouped:start", {
      query: q.length > 0 ? "(set)" : "",
      filterUserId,
      source: "lib/admin/load-admin-teams-grouped.ts · loadAdminTeamsGrouped",
    })
    const supabase = getSupabaseServer()

    const { data: orgRowsFromDb } = await supabase
      .from("organizations")
      .select("id, name, school_id, athletic_department_id")
      .order("name", { ascending: true })
      .limit(500)

    const orgDirectorySource = (orgRowsFromDb ?? []) as OrgRow[]
    console.info("[admin] loadAdminTeamsGrouped:organizations_loaded", {
      count: orgDirectorySource.length,
      ids: orgDirectorySource.map((o) => o.id),
    })

    let orgById = new Map<string, OrgRow>(orgDirectorySource.map((o) => [o.id, o]))

    let teamIds: string[] | null = null
    if (filterUserId) {
      const resolved = new Set<string>()
      const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", filterUserId).maybeSingle()
      if (profile?.team_id) resolved.add(profile.team_id as string)
      const { data: memberRows, error: tmErr } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", filterUserId)
        .eq("active", true)
      if (tmErr) {
        console.warn("[admin] loadAdminTeamsGrouped:team_members_filter_error", {
          filterUserId,
          message: tmErr.message,
        })
      }
      for (const r of memberRows ?? []) {
        const tid = (r as { team_id?: string }).team_id
        if (tid) resolved.add(tid)
      }
      teamIds = [...resolved]
      console.info("[admin] loadAdminTeamsGrouped:filter_user_team_ids", {
        filterUserId,
        count: teamIds.length,
        teamIds,
        fromProfile: Boolean(profile?.team_id),
        fromTeamMembers: (memberRows ?? []).length,
      })
      if (teamIds.length === 0) {
        console.info("[admin] loadAdminTeamsGrouped:no_teams_for_user", { filterUserId })
        return { groups: [], organizationDirectory: emptyDirectory(orgDirectorySource), filterUserId }
      }
    }

    const TEAMS_SELECT_FULL =
      "id, name, plan_tier, subscription_status, team_status, organization_id, created_at, sport, team_level, program_id, school_id, athletic_department_id"
    const TEAMS_SELECT_MINIMAL =
      "id, name, organization_id, created_at, sport, team_level, program_id, school_id, athletic_department_id"

    type TeamsQueryRow = Record<string, unknown>

    let rq = supabase.from("teams").select(TEAMS_SELECT_FULL).order("created_at", { ascending: false }).limit(2000)

    if (teamIds) rq = rq.in("id", teamIds)
    if (q) {
      const { data: matchingOrgs } = await supabase.from("organizations").select("id").ilike("name", `%${q}%`).limit(150)
      const matchingOrgIds = [...new Set((matchingOrgs ?? []).map((o) => (o as { id: string }).id))]
      if (matchingOrgIds.length > 0) {
        rq = rq.or(`name.ilike.%${q}%,organization_id.in.(${matchingOrgIds.join(",")})`)
      } else {
        rq = rq.ilike("name", `%${q}%`)
      }
    }
    const teamsFirst = await rq
    let rows: TeamsQueryRow[] | null = teamsFirst.data as TeamsQueryRow[] | null
    const teamsErr = teamsFirst.error
    if (teamsErr) {
      console.error("[admin] loadAdminTeamsGrouped:teams_query_error", {
        message: teamsErr.message,
        code: teamsErr.code,
        details: teamsErr.details,
        hint: teamsErr.hint,
      })
      let rq2 = supabase.from("teams").select(TEAMS_SELECT_MINIMAL).order("created_at", { ascending: false }).limit(2000)
      if (teamIds) rq2 = rq2.in("id", teamIds)
      if (q) {
        const { data: matchingOrgs } = await supabase.from("organizations").select("id").ilike("name", `%${q}%`).limit(150)
        const matchingOrgIds = [...new Set((matchingOrgs ?? []).map((o) => (o as { id: string }).id))]
        if (matchingOrgIds.length > 0) {
          rq2 = rq2.or(`name.ilike.%${q}%,organization_id.in.(${matchingOrgIds.join(",")})`)
        } else {
          rq2 = rq2.ilike("name", `%${q}%`)
        }
      }
      const second = await rq2
      rows = second.data as TeamsQueryRow[] | null
      if (second.error) {
        console.error("[admin] loadAdminTeamsGrouped:teams_query_retry_failed", {
          message: second.error.message,
          code: second.error.code,
        })
        throw second.error
      }
      console.warn("[admin] loadAdminTeamsGrouped:teams_query_used_minimal_select_after_full_failed")
    }
    const raw = rows ?? []

    console.info("[admin] loadAdminTeamsGrouped:teams_loaded", {
      count: raw.length,
      teamIds: raw.map((t) => (t as { id: string }).id),
    })

    const teamIdList = raw.map((t) => t.id as string)
    const programIds = [...new Set(raw.map((r) => r.program_id as string | null).filter(Boolean))] as string[]
    const schoolIdsDirect = [...new Set(raw.map((r) => r.school_id as string | null).filter(Boolean))] as string[]
    const adIds = [...new Set(raw.map((r) => r.athletic_department_id as string | null).filter(Boolean))] as string[]

    const programsResult =
      programIds.length > 0
        ? await supabase.from("programs").select("id, program_name, sport, organization_id").in("id", programIds)
        : { data: [] as ProgramRow[], error: null as null }
    if (programsResult.error) {
      console.warn("[admin] loadAdminTeamsGrouped:programs_query_warning", {
        message: programsResult.error.message,
        code: programsResult.error.code,
      })
    }
    const programs = programsResult.data ?? []
    const programById = new Map<string, ProgramRow>(programs.map((p) => [p.id as string, p as ProgramRow]))

    const referencedOrgIds = new Set<string>()
    for (const t of raw) {
      const tid = (t as { organization_id?: string | null }).organization_id
      if (tid) referencedOrgIds.add(tid as string)
    }
    for (const p of programs) {
      const pr = p as ProgramRow
      if (pr.organization_id) referencedOrgIds.add(pr.organization_id)
    }
    const missingOrgIds = [...referencedOrgIds].filter((id) => !orgById.has(id))
    if (missingOrgIds.length > 0) {
      const { data: extraOrgs } = await supabase
        .from("organizations")
        .select("id, name, school_id, athletic_department_id")
        .in("id", missingOrgIds)
      for (const o of extraOrgs ?? []) {
        const r = o as OrgRow
        orgById.set(r.id, r)
      }
    }

    const orgsByAthleticDepartmentId = new Map<string, OrgRow[]>()
    const orgsBySchoolId = new Map<string, OrgRow[]>()
    for (const o of orgById.values()) {
      if (o.athletic_department_id) {
        const list = orgsByAthleticDepartmentId.get(o.athletic_department_id) ?? []
        list.push(o)
        orgsByAthleticDepartmentId.set(o.athletic_department_id, list)
      }
      if (o.school_id) {
        const list = orgsBySchoolId.get(o.school_id) ?? []
        list.push(o)
        orgsBySchoolId.set(o.school_id, list)
      }
    }

    const schoolIdsFromOrg = [...new Set(orgDirectorySource.map((o) => o.school_id).filter(Boolean))] as string[]
    const allSchoolIds = [...new Set([...schoolIdsDirect, ...schoolIdsFromOrg])]

    const { data: schools } =
      allSchoolIds.length > 0
        ? await supabase.from("schools").select("id, name").in("id", allSchoolIds)
        : { data: [] as SchoolRow[] }
    const schoolById = new Map<string, SchoolRow>((schools ?? []).map((s) => [s.id as string, s as SchoolRow]))

    const { data: ads } =
      adIds.length > 0
        ? await supabase.from("athletic_departments").select("id, school_id").in("id", adIds)
        : { data: [] as AdRow[] }
    const adById = new Map<string, AdRow>((ads ?? []).map((a) => [a.id as string, a as AdRow]))

    const { data: staffRows } =
      teamIdList.length > 0
        ? await supabase
            .from("team_members")
            .select("team_id, user_id, role, is_primary")
            .in("team_id", teamIdList)
            .eq("active", true)
        : { data: [] as Record<string, unknown>[] }

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
    const { data: hcUsers } =
      headCoachIds.size > 0
        ? await supabase.from("users").select("id, name").in("id", [...headCoachIds])
        : { data: [] as { id: string; name: string | null }[] }
    const hcNameById = new Map((hcUsers ?? []).map((u) => [u.id, u.name?.trim() || null]))

    const teamCountByOrgId = new Map<string, number>()
    let bucketDirect = 0
    let bucketProgram = 0
    let bucketOrgAd = 0
    let bucketOrgSchool = 0
    let bucketUnassigned = 0

    type Tagged = { row: AdminTeamRow; groupKey: string; groupTitle: string; groupHint: string | null }
    const resolutionRows: Array<{
      teamId: string
      teamName: string
      ownershipSource: OwnershipSource
      effectiveOrganizationId: string | null
      directOrganizationId: string | null
      programOrganizationId: string | null
      inferredVia: "none" | "athletic_department" | "school"
    }> = []

    const tagged: Tagged[] = raw.map((t) => {
      const id = t.id as string
      const staff = staffByTeam.get(id) ?? []
      const hcUid = pickHeadCoachUserId(staff)
      const headCoachName =
        hcUid && (hcNameById.get(hcUid) ?? "")?.length ? (hcNameById.get(hcUid) as string) : null
      const coachStaffCount = staff.filter((m) => isHeadCoachRole(m.role) || isAssistantCoachRole(m.role)).length

      const pid = t.program_id as string | null
      const prog = pid ? programById.get(pid) : undefined
      const directOid = (t.organization_id as string | null)?.trim() || null
      const oidFromProgram = prog?.organization_id?.trim() || null
      const fromTeamOrProgram = directOid ?? oidFromProgram ?? null

      const teamAdId = (t.athletic_department_id as string | null)?.trim() || null
      const sidTeam = (t.school_id as string | null) ?? null

      let inferredOid: string | null = null
      let inferredVia: "none" | "athletic_department" | "school" = "none"
      if (!fromTeamOrProgram && teamAdId) {
        const adMatches = orgsByAthleticDepartmentId.get(teamAdId) ?? []
        if (adMatches.length === 1) {
          inferredOid = adMatches[0].id
          inferredVia = "athletic_department"
        } else if (adMatches.length > 1) {
          /* ambiguity: leave inferredOid null */
        }
      }
      if (!fromTeamOrProgram && !inferredOid && sidTeam) {
        const schoolMatches = orgsBySchoolId.get(sidTeam) ?? []
        if (schoolMatches.length === 1) {
          inferredOid = schoolMatches[0].id
          inferredVia = "school"
        }
      }

      const effectiveOidFinal = fromTeamOrProgram ?? inferredOid ?? null

      let ownershipSource: OwnershipSource = "unassigned"
      if (directOid) {
        ownershipSource = "team_organization_id"
        bucketDirect += 1
      } else if (oidFromProgram) {
        ownershipSource = "program_organization_id"
        bucketProgram += 1
      } else if (inferredOid && inferredVia === "athletic_department") {
        ownershipSource = "organization_athletic_department"
        bucketOrgAd += 1
      } else if (inferredOid && inferredVia === "school") {
        ownershipSource = "organization_school"
        bucketOrgSchool += 1
      } else {
        bucketUnassigned += 1
      }

      const orgRow = effectiveOidFinal ? orgById.get(effectiveOidFinal) : undefined
      const resolvedOrgName =
        (orgRow?.name && String(orgRow.name).trim()) ||
        (effectiveOidFinal ? `Unknown organization (${effectiveOidFinal.slice(0, 8)}…)` : null)

      const programName = (prog?.program_name as string | undefined)?.trim() || null

      let schoolName: string | null = null
      const sidFromOrg = orgRow?.school_id ?? null
      const sid = sidTeam ?? sidFromOrg ?? null
      if (sid) {
        schoolName = (schoolById.get(sid)?.name as string | undefined) ?? null
      }

      const legacyParts: string[] = []
      if (prog && !prog.organization_id) {
        legacyParts.push(`Program "${programName ?? prog.id.slice(0, 8)}" has no organization_id`)
      }
      if (!fromTeamOrProgram && teamAdId) {
        const adMatches = orgsByAthleticDepartmentId.get(teamAdId) ?? []
        if (adMatches.length > 1) {
          legacyParts.push(
            `${adMatches.length} organizations tied to this athletic department — set teams.organization_id explicitly`
          )
        }
      }
      if (!fromTeamOrProgram && !inferredOid && sidTeam) {
        const schoolMatches = orgsBySchoolId.get(sidTeam) ?? []
        if (schoolMatches.length > 1) {
          legacyParts.push(
            `${schoolMatches.length} organizations tied to this school — set teams.organization_id explicitly`
          )
        }
      }
      if (sidTeam && schoolName) legacyParts.push(`Team school: ${schoolName}`)
      else if (sidTeam) legacyParts.push(`Team school_id set`)
      const adTeam = t.athletic_department_id as string | null
      if (adTeam) {
        const ad = adById.get(adTeam)
        const adschool = ad?.school_id ? schoolById.get(ad.school_id)?.name : null
        legacyParts.push(
          adschool ? `Athletic dept (school: ${adschool})` : `Athletic dept on team (${adTeam.slice(0, 8)}…)`
        )
      }

      let groupKey: string
      let groupTitle: string
      let groupHint: string | null

      if (effectiveOidFinal) {
        teamCountByOrgId.set(effectiveOidFinal, (teamCountByOrgId.get(effectiveOidFinal) ?? 0) + 1)
        groupKey = `org:${effectiveOidFinal}`
        groupTitle = resolvedOrgName ?? "Organization"
        const hints: string[] = []
        if (programName) hints.push(`Program: ${programName}`)
        if (ownershipSource === "program_organization_id") hints.push("Ownership via program → organization")
        if (ownershipSource === "team_organization_id") hints.push("Ownership via team.organization_id")
        if (ownershipSource === "organization_athletic_department") hints.push("Ownership inferred: unique org for this athletic department")
        if (ownershipSource === "organization_school") hints.push("Ownership inferred: unique org for this school")
        if (schoolName) hints.push(`School (metadata): ${schoolName}`)
        groupHint = hints.length > 0 ? hints.join(" · ") : null
      } else {
        groupKey = "unassigned"
        groupTitle = "Unassigned / Legacy Teams"
        groupHint =
          legacyParts.length > 0
            ? `${legacyParts.join(" · ")} · Assign teams.organization_id or link the program to an organization.`
            : "Link each team to an organization (directly or via its program)."
      }

      const row: AdminTeamRow = {
        id,
        name: t.name as string,
        planTier: (t.plan_tier as string | undefined) ?? null,
        subscriptionStatus: (t.subscription_status as string | undefined) ?? "active",
        teamStatus: (t.team_status as string | undefined) ?? "active",
        organization: { id: effectiveOidFinal, name: resolvedOrgName ?? "—" },
        ownershipSource,
        legacyContext: legacyParts.length > 0 ? legacyParts.join(" · ") : null,
        sport: (t.sport as string | null) ?? (prog?.sport as string | null) ?? null,
        teamLevel: (t.team_level as string | null) ?? null,
        createdAt:
          typeof t.created_at === "string"
            ? t.created_at
            : t.created_at
              ? new Date(t.created_at as string).toISOString()
              : new Date().toISOString(),
        players: [],
        headCoachName,
        coachStaffCount,
      }

      resolutionRows.push({
        teamId: id,
        teamName: row.name,
        ownershipSource,
        effectiveOrganizationId: effectiveOidFinal,
        directOrganizationId: directOid,
        programOrganizationId: oidFromProgram,
        inferredVia,
      })

      return { row, groupKey, groupTitle, groupHint }
    })

    console.info("[admin] loadAdminTeamsGrouped:ownership_buckets", {
      team_organization_id: bucketDirect,
      program_organization_id: bucketProgram,
      organization_via_athletic_department: bucketOrgAd,
      organization_via_school: bucketOrgSchool,
      unassigned: bucketUnassigned,
      teamCountByOrganization: Object.fromEntries(teamCountByOrgId),
    })
    console.info("[admin] loadAdminTeamsGrouped:team_resolution", {
      teams: resolutionRows,
      includedInThisView: raw.length,
    })

    const directoryOrgRows = [...orgById.values()].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" })
    )
    const organizationDirectory: AdminOrganizationDirectoryRow[] = directoryOrgRows.map((o) => ({
      id: o.id,
      name: (o.name ?? "").trim() || "—",
      teamCount: teamCountByOrgId.get(o.id) ?? 0,
    }))
    console.info("[admin] loadAdminTeamsGrouped:organization_directory_built", {
      organizationsInDirectory: organizationDirectory.length,
      organizationsWithTeams: organizationDirectory.filter((o) => o.teamCount > 0).length,
    })

    const groupMap = new Map<string, { groupTitle: string; groupHint: string | null; teams: AdminTeamRow[] }>()
    for (const item of tagged) {
      const g = groupMap.get(item.groupKey) ?? {
        groupTitle: item.groupTitle,
        groupHint: item.groupHint,
        teams: [],
      }
      g.teams.push(item.row)
      groupMap.set(item.groupKey, g)
    }

    const orgGroups: AdminTeamGroup[] = []
    let unassignedGroup: AdminTeamGroup | null = null

    for (const [groupKey, v] of groupMap.entries()) {
      const section: AdminTeamGroup = {
        groupKey,
        groupTitle: v.groupTitle,
        groupHint: v.groupHint,
        teams: v.teams.sort((a, b) => a.name.localeCompare(b.name)),
      }
      if (groupKey === "unassigned") {
        unassignedGroup = section
      } else {
        orgGroups.push(section)
      }
    }

    orgGroups.sort((a, b) => a.groupTitle.localeCompare(b.groupTitle))
    const groups: AdminTeamGroup[] = [...orgGroups, ...(unassignedGroup ? [unassignedGroup] : [])]

    return { groups, organizationDirectory, filterUserId }
  }, fallback)
}
