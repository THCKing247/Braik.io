import type { SupabaseClient } from "@supabase/supabase-js"

export interface RecruitingSearchFilters {
  position?: string | null
  graduationYear?: number | null
  state?: string | null
  teamLevel?: string | null
  heightFeetMin?: number | null
  heightInchesMin?: number | null
  weightLbsMin?: number | null
  fortyTimeMax?: number | null
  gpaMin?: number | null
  playbookMasteryMin?: number | null
  recruitingVisibilityOnly?: boolean
  limit?: number
  offset?: number
}

export interface RecruitingSearchResultCard {
  playerId: string
  slug: string | null
  firstName: string
  lastName: string
  positionGroup: string | null
  graduationYear: number | null
  heightFeet: number | null
  heightInches: number | null
  weightLbs: number | null
  fortyTime: number | null
  teamName: string | null
  teamLevel: string | null
  programName: string | null
  state: string | null
  keyStatSummary: string | null
  playbookMasteryPct: number | null
  recruitingVisibility: boolean
}

/**
 * Search players with recruiting profiles where recruiting_visibility = true.
 * Applies filters and returns result cards for the recruiter portal.
 */
export async function searchRecruitingProfiles(
  supabase: SupabaseClient,
  filters: RecruitingSearchFilters
): Promise<{ results: RecruitingSearchResultCard[]; total: number }> {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100)
  const offset = filters.offset ?? 0

  // Base: player_recruiting_profiles with recruiting_visibility = true
  let query = supabase
    .from("player_recruiting_profiles")
    .select("player_id, slug, graduation_year, height_feet, height_inches, weight_lbs, forty_time, gpa, recruiting_visibility", { count: "exact" })
    .eq("recruiting_visibility", true)

  if (filters.graduationYear != null) {
    query = query.eq("graduation_year", filters.graduationYear)
  }
  if (filters.heightFeetMin != null) {
    query = query.gte("height_feet", filters.heightFeetMin)
  }
  if (filters.weightLbsMin != null) {
    query = query.gte("weight_lbs", filters.weightLbsMin)
  }
  if (filters.fortyTimeMax != null) {
    query = query.lte("forty_time", filters.fortyTimeMax)
  }
  if (filters.gpaMin != null) {
    query = query.gte("gpa", filters.gpaMin)
  }

  const { data: profiles, error: profileError, count } = await query.range(offset, offset + limit - 1)

  if (profileError) {
    return { results: [], total: 0 }
  }
  const total = count ?? 0
  if (!profiles?.length) {
    return { results: [], total }
  }

  const playerIds = profiles.map((p) => p.player_id)
  const profileByPlayer = new Map(profiles.map((p) => [p.player_id, p]))

  const { data: players } = await supabase
    .from("players")
    .select("id, first_name, last_name, position_group, team_id")
    .in("id", playerIds)

  if (!players?.length) return { results: [], total: 0 }

  const teamIds = [...new Set(players.map((p) => (p as { team_id: string }).team_id).filter(Boolean))]
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, team_level, program_id, school_id")
    .in("id", teamIds)

  const programIds = [...new Set((teams ?? []).map((t) => (t as { program_id?: string }).program_id).filter(Boolean))]
  const { data: programs } = await supabase.from("programs").select("id, program_name, organization_id").in("id", programIds)
  const orgIds = [...new Set((programs ?? []).map((p) => (p as { organization_id?: string }).organization_id).filter(Boolean))]
  const { data: orgs } = await supabase.from("organizations").select("id, school_id").in("id", orgIds)
  const schoolIds = [...new Set((orgs ?? []).map((o) => (o as { school_id?: string }).school_id).filter(Boolean))]
  const { data: schools } =
    schoolIds.length > 0 ? await supabase.from("schools").select("id, state").in("id", schoolIds) : { data: [] }
  const stateBySchoolId = new Map((schools ?? []).map((s) => [s.id, (s as { state?: string }).state ?? null]))
  const schoolIdByOrgId = new Map((orgs ?? []).map((o) => [o.id, (o as { school_id?: string }).school_id]))
  const orgIdByProgramId = new Map((programs ?? []).map((p) => [p.id, (p as { organization_id?: string }).organization_id]))
  const stateByProgramId = new Map<string, string | null>()
  for (const [programId, orgId] of orgIdByProgramId) {
    if (orgId) {
      const schoolId = schoolIdByOrgId.get(orgId)
      stateByProgramId.set(programId, schoolId ? stateBySchoolId.get(schoolId) ?? null : null)
    }
  }

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]))
  const programById = new Map(programs ?? [])

  // Playbook mastery for filter and summary (if playbookMasteryMin requested, filter in memory)
  let masteryByPlayer: Map<string, number> = new Map()
  if (filters.playbookMasteryMin != null || true) {
    const { data: knowledge } = await supabase
      .from("player_play_knowledge")
      .select("player_id, status")
      .in("player_id", playerIds)
    const { data: assignments } = await supabase.from("play_assignments").select("team_level")
    const totalAssigned = (assignments ?? []).length
    const completedByPlayer = new Map<string, number>()
    for (const k of knowledge ?? []) {
      if (k.player_id) {
        const n = completedByPlayer.get(k.player_id) ?? 0
        completedByPlayer.set(k.player_id, n + (k.status === "quiz_passed" || k.status === "completed" ? 1 : 0))
      }
    }
    // Mastery % = completed / total assigned for program; we don't have program per player here, use global total or per-program later
    const { data: pa } = await supabase.from("play_assignments").select("id")
    const totalPa = (pa ?? []).length
    for (const pid of playerIds) {
      const completed = completedByPlayer.get(pid) ?? 0
      masteryByPlayer.set(pid, totalPa > 0 ? Math.round((completed / totalPa) * 100) : 0)
    }
  }

  const results: RecruitingSearchResultCard[] = []
  for (const player of players) {
    const profile = profileByPlayer.get(player.id)
    if (!profile) continue
    const team = teamById.get((player as { team_id: string }).team_id)
    const programId = team ? (team as { program_id?: string }).program_id : null
    const program = programId ? programById.get(programId) : null
    const state = programId ? stateByProgramId.get(programId) ?? null : null
    const teamLevel = team ? (team as { team_level?: string }).team_level ?? null : null

    if (filters.position != null && filters.position.trim() !== "") {
      const pos = (player as { position_group?: string }).position_group ?? ""
      if (pos.toLowerCase() !== filters.position!.trim().toLowerCase()) continue
    }
    if (filters.teamLevel != null && teamLevel?.toLowerCase() !== filters.teamLevel.trim().toLowerCase()) continue
    if (filters.state != null && state?.toLowerCase() !== filters.state.trim().toLowerCase()) continue
    const masteryPct = masteryByPlayer.get(player.id) ?? null
    if (filters.playbookMasteryMin != null && (masteryPct == null || masteryPct < filters.playbookMasteryMin)) continue

    const keyStatSummary = [
      profile.forty_time != null ? `40: ${profile.forty_time}` : null,
      profile.weight_lbs != null ? `${profile.weight_lbs} lbs` : null,
      profile.gpa != null ? `GPA ${profile.gpa}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null

    results.push({
      playerId: player.id,
      slug: (profile as { slug?: string }).slug ?? null,
      firstName: (player as { first_name?: string }).first_name ?? "",
      lastName: (player as { last_name?: string }).last_name ?? "",
      positionGroup: (player as { position_group?: string }).position_group ?? null,
      graduationYear: profile.graduation_year,
      heightFeet: profile.height_feet,
      heightInches: profile.height_inches,
      weightLbs: profile.weight_lbs,
      fortyTime: profile.forty_time != null ? Number(profile.forty_time) : null,
      teamName: team ? (team as { name?: string }).name ?? null : null,
      teamLevel,
      programName: program ? (program as { program_name?: string }).program_name ?? null : null,
      state,
      keyStatSummary,
      playbookMasteryPct: masteryPct,
      recruitingVisibility: profile.recruiting_visibility,
    })
  }

  return { results, total }
}
