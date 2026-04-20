import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"
import { isAssistantCoachRole, isHeadCoachRole, pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

export type AdminTeamRow = {
  id: string
  name: string
  planTier: string | null
  subscriptionStatus: string
  teamStatus: string
  organization: { name: string }
  sport: string | null
  teamLevel: string | null
  createdAt: string
  players: Array<{ id: string }>
  headCoachName: string | null
  coachStaffCount: number
}

export type AdminTeamGroup = {
  groupKey: string
  groupTitle: string
  groupHint: string | null
  teams: AdminTeamRow[]
}

export async function loadAdminTeamsGrouped(params: {
  query?: string
  filterUserId?: string | null
}): Promise<{ groups: AdminTeamGroup[]; filterUserId: string | null }> {
  const q = params.query?.trim() || ""
  const filterUserId = params.filterUserId?.trim() || null

  return safeAdminDbQuery(async () => {
    const supabase = getSupabaseServer()
    let teamIds: string[] | null = null
    if (filterUserId) {
      const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", filterUserId).maybeSingle()
      teamIds = profile?.team_id ? [profile.team_id] : []
      if (teamIds.length === 0) {
        return { groups: [] as AdminTeamGroup[], filterUserId }
      }
    }

    let rq = supabase
      .from("teams")
      .select(
        "id, name, plan_tier, subscription_status, team_status, org, organization_id, created_at, sport, team_level, program_id, school_id, athletic_department_id"
      )
      .order("created_at", { ascending: false })
      .limit(2000)

    if (teamIds) rq = rq.in("id", teamIds)
    if (q) {
      rq = rq.or(`name.ilike.%${q}%,org.ilike.%${q}%`)
    }
    const { data: rows } = await rq
    const raw = rows ?? []
    const teamIdList = raw.map((t) => t.id as string)

    const directOrgIds = [...new Set(raw.map((r) => r.organization_id as string | null).filter(Boolean))] as string[]
    const programIds = [...new Set(raw.map((r) => r.program_id as string | null).filter(Boolean))] as string[]
    const schoolIdsDirect = [...new Set(raw.map((r) => r.school_id as string | null).filter(Boolean))] as string[]
    const adIds = [...new Set(raw.map((r) => r.athletic_department_id as string | null).filter(Boolean))] as string[]

    type ProgramRow = {
      id: string
      program_name: string | null
      sport: string | null
      organization_id: string | null
    }
    type OrgRow = {
      id: string
      name: string | null
      school_id: string | null
      athletic_department_id: string | null
    }
    type SchoolRow = { id: string; name: string | null }
    type AdRow = { id: string; school_id: string | null }

    const { data: programs } =
      programIds.length > 0
        ? await supabase.from("programs").select("id, program_name, sport, organization_id").in("id", programIds)
        : { data: [] as ProgramRow[] }
    const programById = new Map<string, ProgramRow>(
      (programs ?? []).map((p) => [p.id as string, p as ProgramRow])
    )

    const orgIdsFromPrograms = [...new Set((programs ?? []).map((p) => p.organization_id as string | null).filter(Boolean))] as string[]
    const orgIds = [...new Set([...directOrgIds, ...orgIdsFromPrograms])]
    const { data: organizations } =
      orgIds.length > 0
        ? await supabase.from("organizations").select("id, name, school_id, athletic_department_id").in("id", orgIds)
        : { data: [] as OrgRow[] }
    const orgById = new Map<string, OrgRow>((organizations ?? []).map((o) => [o.id as string, o as OrgRow]))

    const schoolIdsFromOrg = [...new Set((organizations ?? []).map((o) => o.school_id as string | null).filter(Boolean))] as string[]
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

    type Tagged = { row: AdminTeamRow; groupKey: string; groupTitle: string; groupHint: string | null }
    const tagged: Tagged[] = raw.map((t) => {
      const id = t.id as string
      const staff = staffByTeam.get(id) ?? []
      const hcUid = pickHeadCoachUserId(staff)
      const headCoachName =
        hcUid && (hcNameById.get(hcUid) ?? "")?.length ? (hcNameById.get(hcUid) as string) : null
      const coachStaffCount = staff.filter((m) => isHeadCoachRole(m.role) || isAssistantCoachRole(m.role)).length

      const pid = t.program_id as string | null
      const prog = pid ? programById.get(pid) : undefined
      const directOid = t.organization_id as string | null
      const oidFromProgram = prog?.organization_id as string | undefined
      const oid = (directOid ?? oidFromProgram) as string | undefined
      const orgRow = oid ? orgById.get(oid) : undefined
      const orgName = (orgRow?.name as string | undefined) ?? null
      const programName = (prog?.program_name as string | undefined) ?? null

      let schoolName: string | null = null
      const sid = (t.school_id as string | null) ?? (orgRow?.school_id as string | undefined) ?? null
      if (sid) {
        schoolName = (schoolById.get(sid)?.name as string | undefined) ?? null
      }

      let groupKey: string
      let groupTitle: string
      let groupHint: string | null

      if (oid) {
        groupKey = `org:${oid}`
        if (orgName && programName) {
          groupTitle = `${orgName} — ${programName}`
          groupHint = schoolName ? `School: ${schoolName}` : null
        } else if (orgName) {
          groupTitle = orgName
          groupHint = programName ?? null
        } else {
          groupTitle = programName ?? "Program"
          groupHint = null
        }
      } else if (sid) {
        groupKey = `school:${sid}`
        groupTitle = schoolName ?? "School"
        const adid = t.athletic_department_id as string | null
        if (adid) {
          const ad = adById.get(adid)
          const adsid = ad?.school_id as string | undefined
          groupHint = adsid ? `Athletic department · ${(schoolById.get(adsid)?.name as string) ?? ""}` : "Athletic department"
        } else {
          groupHint = null
        }
      } else if (t.athletic_department_id) {
        const adid = t.athletic_department_id as string
        groupKey = `ad:${adid}`
        const ad = adById.get(adid)
        const adsid = ad?.school_id as string | undefined
        const sn = adsid ? (schoolById.get(adsid)?.name as string | undefined) : null
        groupTitle = sn ? `${sn} (athletic department)` : "Athletic department"
        groupHint = null
      } else if (String(t.org || "").trim()) {
        const legacy = String(t.org).trim()
        groupKey = `legacy:${legacy}`
        groupTitle = legacy
        groupHint = "Legacy org field"
      } else {
        groupKey = "unassigned"
        groupTitle = "Unassigned / legacy"
        groupHint = "No program, school, or organization link"
      }

      const row: AdminTeamRow = {
        id,
        name: t.name as string,
        planTier: (t.plan_tier as string | undefined) ?? null,
        subscriptionStatus: (t.subscription_status as string | undefined) ?? "active",
        teamStatus: (t.team_status as string | undefined) ?? "active",
        organization: { name: orgName ?? legacyOrg(t) },
        sport: (t.sport as string | null) ?? (prog?.sport as string | null) ?? null,
        teamLevel: (t.team_level as string | null) ?? null,
        createdAt:
          typeof t.created_at === "string" ? t.created_at : new Date(t.created_at as string).toISOString(),
        players: [],
        headCoachName,
        coachStaffCount,
      }

      return { row, groupKey, groupTitle, groupHint }
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

    const groups: AdminTeamGroup[] = [...groupMap.entries()]
      .map(([groupKey, v]) => ({
        groupKey,
        groupTitle: v.groupTitle,
        groupHint: v.groupHint,
        teams: v.teams.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.groupTitle.localeCompare(b.groupTitle))

    return { groups, filterUserId }
  }, { groups: [] as AdminTeamGroup[], filterUserId })
}

function legacyOrg(t: Record<string, unknown>): string {
  const o = t.org
  return typeof o === "string" && o.trim() ? o.trim() : "—"
}
