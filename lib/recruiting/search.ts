import type { SupabaseClient } from "@supabase/supabase-js"

export interface RecruitingSearchFilters {
  position?: string | null
  graduationYear?: number | null
  /** When set, only players on this team (players.team_id) are included */
  teamId?: string | null
  state?: string | null
  teamLevel?: string | null
  heightFeetMin?: number | null
  heightInchesMin?: number | null
  weightLbsMin?: number | null
  fortyTimeMax?: number | null
  gpaMin?: number | null
  playbookMasteryMin?: number | null
  recruitingVisibilityOnly?: boolean
  /**
   * When true, keep only profiles that have something concrete to show publicly
   * (video links, Hudl/YouTube, bio, or at least one measurable).
   */
  requireListingQuality?: boolean
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

type ProfileListingRow = {
  player_id: string
  slug: string | null
  graduation_year: number | null
  height_feet: number | null
  height_inches: number | null
  weight_lbs: number | null
  forty_time: number | null
  gpa: number | null
  bio: string | null
  hudl_url: string | null
  youtube_url: string | null
  recruiting_visibility: boolean
}

/** True if the profile is worth showing on a public browse list (has film, social video URLs, bio, or measurables). */
export function playerHasPublicListingSignal(
  profile: {
    bio?: string | null
    hudl_url?: string | null
    youtube_url?: string | null
    height_feet?: number | null
    weight_lbs?: number | null
    forty_time?: number | null
    gpa?: number | null
  },
  hasVideoLink: boolean
): boolean {
  if (hasVideoLink) return true
  if (profile.hudl_url?.trim()) return true
  if (profile.youtube_url?.trim()) return true
  if (profile.bio?.trim()) return true
  if (
    profile.height_feet != null ||
    profile.weight_lbs != null ||
    profile.forty_time != null ||
    profile.gpa != null
  ) {
    return true
  }
  return false
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
    .select(
      "player_id, slug, graduation_year, height_feet, height_inches, weight_lbs, forty_time, gpa, bio, hudl_url, youtube_url, recruiting_visibility",
      { count: "exact" }
    )
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
  const profileByPlayer = new Map(
    profiles.map((p) => {
      const raw = p as Record<string, unknown>
      const row: ProfileListingRow = {
        player_id: String(raw.player_id),
        slug: (raw.slug as string | null) ?? null,
        graduation_year: (raw.graduation_year as number | null) ?? null,
        height_feet: (raw.height_feet as number | null) ?? null,
        height_inches: (raw.height_inches as number | null) ?? null,
        weight_lbs: (raw.weight_lbs as number | null) ?? null,
        forty_time: raw.forty_time != null ? Number(raw.forty_time) : null,
        gpa: raw.gpa != null ? Number(raw.gpa) : null,
        bio: (raw.bio as string | null) ?? null,
        hudl_url: (raw.hudl_url as string | null) ?? null,
        youtube_url: (raw.youtube_url as string | null) ?? null,
        recruiting_visibility: Boolean(raw.recruiting_visibility),
      }
      return [row.player_id, row] as const
    })
  )

  let playersWithVideo = new Set<string>()
  if (filters.requireListingQuality && playerIds.length > 0) {
    const { data: vidRows } = await supabase.from("player_video_links").select("player_id").in("player_id", playerIds)
    playersWithVideo = new Set((vidRows ?? []).map((r: { player_id: string }) => r.player_id))
  }

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
  const programById = new Map((programs ?? []).map((p) => [(p as { id: string }).id, p]))

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
    if (filters.requireListingQuality) {
      const hasVid = playersWithVideo.has(player.id)
      if (!playerHasPublicListingSignal(profile, hasVid)) continue
    }
    const team = teamById.get((player as { team_id: string }).team_id)
    const programId = team ? (team as { program_id?: string }).program_id : null
    const program = programId ? programById.get(programId) : null
    const state = programId ? stateByProgramId.get(programId) ?? null : null
    const teamLevel = team ? (team as { team_level?: string }).team_level ?? null : null

    if (filters.teamId != null && filters.teamId.trim() !== "") {
      if ((player as { team_id?: string }).team_id !== filters.teamId) continue
    }
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

export interface RecruitingBrowseMeta {
  teams: Array<{ id: string; name: string }>
  positions: string[]
  graduationYears: number[]
}

/**
 * Distinct filter options for the public recruiting browser: teams/positions/years that appear
 * among recruiting-visible profiles that also pass the public listing-quality bar.
 */
export async function getRecruitingBrowseMeta(supabase: SupabaseClient): Promise<RecruitingBrowseMeta> {
  const { data: profiles } = await supabase
    .from("player_recruiting_profiles")
    .select(
      "player_id, graduation_year, bio, hudl_url, youtube_url, height_feet, weight_lbs, forty_time, gpa"
    )
    .eq("recruiting_visibility", true)

  if (!profiles?.length) {
    return { teams: [], positions: [], graduationYears: [] }
  }

  const playerIds = profiles.map((p) => (p as { player_id: string }).player_id)
  const { data: vidRows } = await supabase.from("player_video_links").select("player_id").in("player_id", playerIds)
  const videoSet = new Set((vidRows ?? []).map((r: { player_id: string }) => r.player_id))

  const qualityIds = new Set<string>()
  const yearSet = new Set<number>()
  for (const row of profiles) {
    const pr = row as ProfileListingRow
    if (
      playerHasPublicListingSignal(
        {
          bio: pr.bio,
          hudl_url: pr.hudl_url,
          youtube_url: pr.youtube_url,
          height_feet: pr.height_feet,
          weight_lbs: pr.weight_lbs,
          forty_time: pr.forty_time != null ? Number(pr.forty_time) : null,
          gpa: pr.gpa != null ? Number(pr.gpa) : null,
        },
        videoSet.has(pr.player_id)
      )
    ) {
      qualityIds.add(pr.player_id)
      if (pr.graduation_year != null) yearSet.add(pr.graduation_year)
    }
  }

  if (qualityIds.size === 0) {
    return { teams: [], positions: [], graduationYears: [...yearSet].sort((a, b) => b - a) }
  }

  const { data: players } = await supabase
    .from("players")
    .select("id, position_group, team_id")
    .in("id", [...qualityIds])

  const positionSet = new Set<string>()
  const teamIds = new Set<string>()
  for (const pl of players ?? []) {
    const pos = (pl as { position_group?: string }).position_group?.trim()
    if (pos) positionSet.add(pos)
    const tid = (pl as { team_id?: string }).team_id
    if (tid) teamIds.add(tid)
  }

  const { data: teams } =
    teamIds.size > 0
      ? await supabase.from("teams").select("id, name").in("id", [...teamIds]).order("name")
      : { data: [] }

  return {
    teams: (teams ?? []).map((t: { id: string; name?: string }) => ({ id: t.id, name: t.name ?? "" })),
    positions: [...positionSet].sort((a, b) => a.localeCompare(b)),
    graduationYears: [...yearSet].sort((a, b) => b - a),
  }
}
