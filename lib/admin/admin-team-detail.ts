import type { SupabaseClient } from "@supabase/supabase-js"
import { displayOrganizationName } from "@/lib/teams/team-organization-name"
import { normalizeTeamMemberRole } from "@/lib/team-staff"
import { loadStaffRowsForTeams, pickHeadCoachUserId, resolveAthleticDepartmentIdForTeam } from "@/lib/admin/athletic-departments-scope"

/** Parsed from `teams.programs.organizations` embed (same shape as admin teams list). */
function organizationFromTeamProgramsEmbed(programs: unknown): {
  id: string
  name: string | null
  athletic_department_id: string | null
  video_clips_enabled: boolean | null
} | null {
  if (programs == null) return null
  const row = Array.isArray(programs) ? programs[0] : programs
  if (!row || typeof row !== "object") return null
  const org = (row as { organizations?: unknown }).organizations
  if (org == null) return null
  const o = Array.isArray(org) ? org[0] : org
  if (!o || typeof o !== "object") return null
  const r = o as {
    id?: string
    name?: string | null
    athletic_department_id?: string | null
    video_clips_enabled?: boolean | null
  }
  if (typeof r.id !== "string") return null
  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name : null,
    athletic_department_id: r.athletic_department_id ?? null,
    video_clips_enabled:
      typeof r.video_clips_enabled === "boolean" ? r.video_clips_enabled : r.video_clips_enabled ?? null,
  }
}

export type AdminTeamDetailStaffRow = {
  userId: string
  name: string | null
  role: string | null
}

export type AdminTeamDetail = {
  id: string
  name: string
  sport: string | null
  teamLevel: string | null
  teamStatus: string
  subscriptionStatus: string
  planTier: string | null
  programId: string | null
  athleticDepartmentId: string | null
  resolvedAthleticDepartmentId: string | null
  organizationId: string | null
  organizationName: string
  schoolName: string | null
  videoClipsEnabled: boolean
  organizationVideoEnabled: boolean | null
  videoEffectiveEnabled: boolean
  videoEffectiveBlockReason: "school" | "organization" | "team" | null
  headCoachName: string | null
  headCoachUserId: string | null
  staff: AdminTeamDetailStaffRow[]
  baseAiCredits: number
  aiUsageThisCycle: number
  aiEnabled: boolean
  aiDisabledByPlatform: boolean
}

const SELECT_CASCADE = [
  "id, name, sport, team_level, team_status, subscription_status, plan_tier, program_id, athletic_department_id, school_id, video_clips_enabled, base_ai_credits, ai_usage_this_cycle, ai_enabled, ai_disabled_by_platform, created_at, programs(organizations(id, name, athletic_department_id, video_clips_enabled))",
  "id, name, sport, team_level, team_status, subscription_status, plan_tier, program_id, athletic_department_id, school_id, video_clips_enabled, base_ai_credits, ai_usage_this_cycle, created_at, programs(organizations(id, name, athletic_department_id, video_clips_enabled))",
  "id, name, sport, team_level, team_status, subscription_status, plan_tier, program_id, athletic_department_id, school_id, video_clips_enabled, base_ai_credits, ai_usage_this_cycle, created_at, programs(organizations(name))",
  "id, name, team_status, subscription_status, plan_tier, program_id, athletic_department_id, school_id, video_clips_enabled, base_ai_credits, ai_usage_this_cycle, created_at",
  "id, name, team_status, subscription_status, program_id, created_at",
] as const

/**
 * Super Admin team drill-down: service-role client, same org resolution as athletic department teams table.
 */
export async function loadAdminTeamDetail(
  supabase: SupabaseClient,
  teamId: string
): Promise<AdminTeamDetail | null> {
  console.info("[admin/team-detail] incoming teamId", { teamId })

  let lastErr: { message: string } | null = null
  let raw: Record<string, unknown> | null = null

  for (const select of SELECT_CASCADE) {
    const { data, error } = await supabase.from("teams").select(select).eq("id", teamId).maybeSingle()
    if (error) {
      lastErr = error
      console.warn("[admin/team-detail] teams select failed, trying fallback", {
        teamId,
        selectPrefix: select.slice(0, 72),
        message: error.message,
      })
      continue
    }
    if (!data) {
      console.info("[admin/team-detail] team record not found", { teamId, queryError: null })
      return null
    }
    raw = data as unknown as Record<string, unknown>
    break
  }

  if (!raw) {
    const msg = lastErr?.message ?? "Failed to load team"
    console.error("[admin/team-detail] team query exhausted cascades", { teamId, queryError: msg })
    throw new Error(msg)
  }

  const programId = (raw.program_id as string | null | undefined) ?? null
  const teamAdId = (raw.athletic_department_id as string | null | undefined) ?? null
  const orgEmbed = organizationFromTeamProgramsEmbed(raw.programs)

  const resolvedAdId = resolveAthleticDepartmentIdForTeam({
    teamAthleticDepartmentId: teamAdId,
    organizationAthleticDepartmentId: orgEmbed?.athletic_department_id ?? null,
  })

  let schoolName: string | null = null
  let adVideoOn = false
  if (resolvedAdId) {
    const { data: adRow, error: adErr } = await supabase
      .from("athletic_departments")
      .select("school_id, video_clips_enabled")
      .eq("id", resolvedAdId)
      .maybeSingle()
    if (adErr) {
      console.warn("[admin/team-detail] athletic_departments lookup", { teamId, message: adErr.message })
    } else if (adRow) {
      adVideoOn = Boolean((adRow as { video_clips_enabled?: boolean }).video_clips_enabled)
      const sid = (adRow as { school_id?: string }).school_id
      if (sid) {
        const { data: sch } = await supabase.from("schools").select("name").eq("id", sid).maybeSingle()
        schoolName = (sch as { name?: string } | null)?.name?.trim() || null
      }
    }
  } else {
    const sid = (raw.school_id as string | null | undefined) ?? null
    if (sid) {
      const { data: sch } = await supabase.from("schools").select("name").eq("id", sid).maybeSingle()
      schoolName = (sch as { name?: string } | null)?.name?.trim() || null
    }
  }

  let orgVideoBool: boolean | null = null
  if (orgEmbed?.id) {
    if (typeof orgEmbed.video_clips_enabled === "boolean") {
      orgVideoBool = orgEmbed.video_clips_enabled
    } else {
      const { data: oRow } = await supabase
        .from("organizations")
        .select("video_clips_enabled")
        .eq("id", orgEmbed.id)
        .maybeSingle()
      orgVideoBool =
        oRow != null ? Boolean((oRow as { video_clips_enabled?: boolean }).video_clips_enabled) : null
    }
  }

  const teamVid = Boolean(raw.video_clips_enabled)
  const orgOk = orgVideoBool == null ? true : orgVideoBool

  let videoEffectiveBlockReason: "school" | "organization" | "team" | null = null
  if (resolvedAdId && !adVideoOn) videoEffectiveBlockReason = "school"
  else if (orgVideoBool === false) videoEffectiveBlockReason = "organization"
  else if (!teamVid) videoEffectiveBlockReason = "team"
  const videoEffectiveEnabled = Boolean((resolvedAdId ? adVideoOn : true) && orgOk && teamVid)

  const staffMap = await loadStaffRowsForTeams(supabase, [teamId])
  const staffRows = staffMap.get(teamId) ?? []
  const hcUid = pickHeadCoachUserId(staffRows)

  const staffUserIds = [...new Set(staffRows.map((s) => s.user_id).filter(Boolean))]
  const nameByUserId = new Map<string, string | null>()
  if (staffUserIds.length > 0) {
    const { data: users, error: uErr } = await supabase.from("users").select("id, name").in("id", staffUserIds)
    if (uErr) {
      console.warn("[admin/team-detail] users lookup for staff", { teamId, message: uErr.message })
    }
    for (const u of users ?? []) {
      const ur = u as { id: string; name?: string | null }
      nameByUserId.set(ur.id, ur.name?.trim() || null)
    }
  }

  let headCoachName: string | null = null
  if (hcUid) {
    headCoachName = nameByUserId.get(hcUid) ?? null
    if (!headCoachName) {
      const { data: hcUser } = await supabase.from("users").select("name").eq("id", hcUid).maybeSingle()
      headCoachName = (hcUser as { name?: string | null } | null)?.name?.trim() || null
    }
  }

  const coachStaff = staffRows.filter((m) => {
    const r = normalizeTeamMemberRole(m.role)
    return r !== "player" && r !== "parent"
  })
  const staff: AdminTeamDetailStaffRow[] = coachStaff.map((m) => ({
    userId: m.user_id,
    name: nameByUserId.get(m.user_id) ?? null,
    role: m.role ?? null,
  }))
  staff.sort((a, b) => {
    const ar = (a.role ?? "").toLowerCase()
    const br = (b.role ?? "").toLowerCase()
    if (ar === "head_coach" && br !== "head_coach") return -1
    if (br === "head_coach" && ar !== "head_coach") return 1
    return (a.name ?? "").localeCompare(b.name ?? "")
  })

  const orgNameDisplay = displayOrganizationName(raw as { name?: string | null; programs?: unknown })

  const aiEnabled = Boolean(raw.ai_enabled ?? true)
  const aiDisabledByPlatform = Boolean(raw.ai_disabled_by_platform ?? false)

  console.info("[admin/team-detail] loaded", {
    teamId,
    found: true,
    athletic_department_id: teamAdId,
    resolved_athletic_department_id: resolvedAdId,
    program_id: programId,
    organization_id: orgEmbed?.id ?? null,
    schoolName: schoolName ?? null,
    queryError: null,
  })

  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    sport: (raw.sport as string | null | undefined) ?? null,
    teamLevel: (raw.team_level as string | null | undefined) ?? null,
    teamStatus: String(raw.team_status ?? "active"),
    subscriptionStatus: String(raw.subscription_status ?? "active"),
    planTier: (raw.plan_tier as string | null | undefined) ?? null,
    programId,
    athleticDepartmentId: teamAdId,
    resolvedAthleticDepartmentId: resolvedAdId,
    organizationId: orgEmbed?.id ?? null,
    organizationName: orgNameDisplay,
    schoolName,
    videoClipsEnabled: teamVid,
    organizationVideoEnabled: orgVideoBool,
    videoEffectiveEnabled,
    videoEffectiveBlockReason: videoEffectiveEnabled ? null : videoEffectiveBlockReason,
    headCoachName,
    headCoachUserId: hcUid,
    staff,
    baseAiCredits: Number(raw.base_ai_credits ?? 0),
    aiUsageThisCycle: Number(raw.ai_usage_this_cycle ?? 0),
    aiEnabled,
    aiDisabledByPlatform,
  }
}
