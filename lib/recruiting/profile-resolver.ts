import type { SupabaseClient } from "@supabase/supabase-js"

export interface RecruitingProfileView {
  playerId: string
  slug: string | null
  programId: string | null
  teamId: string | null
  graduationYear: number | null
  heightFeet: number | null
  heightInches: number | null
  weightLbs: number | null
  fortyTime: number | null
  shuttleTime: number | null
  verticalJump: number | null
  gpa: number | null
  recruitingVisibility: boolean
  statsVisible: boolean
  coachNotesVisible: boolean
  playbookMasteryVisible: boolean
  developmentVisible: boolean
  bio: string | null
  xHandle: string | null
  instagramHandle: string | null
  hudlUrl: string | null
  youtubeUrl: string | null
  createdAt: string
  updatedAt: string
  // Resolved from player
  firstName: string
  lastName: string
  positionGroup: string | null
  jerseyNumber: number | null
  teamName: string | null
  teamLevel: string | null
  programName: string | null
}

/** DB row shape for player_recruiting_profiles (used for Supabase select("*") when types are not generated). */
interface PlayerRecruitingProfileRow {
  id: string
  player_id: string
  program_id: string | null
  team_id: string | null
  graduation_year: number | null
  height_feet: number | null
  height_inches: number | null
  weight_lbs: number | null
  forty_time: number | null
  shuttle_time: number | null
  vertical_jump: number | null
  gpa: number | null
  recruiting_visibility: boolean
  stats_visible: boolean
  coach_notes_visible: boolean
  playbook_mastery_visible: boolean
  development_visible: boolean
  bio: string | null
  x_handle: string | null
  instagram_handle: string | null
  hudl_url: string | null
  youtube_url: string | null
  slug: string | null
  created_at: string
  updated_at: string
}

/**
 * Resolve recruiting profile by player id or slug.
 * Returns null if not found or recruiting_visibility is false (when requireVisible is true).
 */
export async function getRecruitingProfileByPlayerIdOrSlug(
  supabase: SupabaseClient,
  playerIdOrSlug: string,
  options: { requireVisible?: boolean } = {}
): Promise<RecruitingProfileView | null> {
  const { requireVisible = false } = options

  const isId = /^[0-9a-f-]{36}$/i.test(playerIdOrSlug)

  let profileRow: PlayerRecruitingProfileRow | null = null
  if (isId) {
    const { data } = await supabase
      .from("player_recruiting_profiles")
      .select("*")
      .eq("player_id", playerIdOrSlug)
      .maybeSingle()
    profileRow = data as PlayerRecruitingProfileRow | null
  } else {
    const { data } = await supabase
      .from("player_recruiting_profiles")
      .select("*")
      .eq("slug", playerIdOrSlug)
      .maybeSingle()
    profileRow = data as PlayerRecruitingProfileRow | null
  }

  if (!profileRow) return null
  if (requireVisible && !profileRow.recruiting_visibility) return null

  const { data: player } = await supabase
    .from("players")
    .select("id, first_name, last_name, position_group, jersey_number, team_id")
    .eq("id", profileRow.player_id)
    .maybeSingle()

  if (!player) return null

  let teamName: string | null = null
  let teamLevel: string | null = null
  let programName: string | null = null
  const teamId = (player as { team_id?: string }).team_id ?? profileRow.team_id
  if (teamId) {
    const { data: team } = await supabase.from("teams").select("name, team_level, program_id").eq("id", teamId).maybeSingle()
    if (team) {
      teamName = (team as { name?: string }).name ?? null
      teamLevel = (team as { team_level?: string }).team_level ?? null
      const programId = (team as { program_id?: string }).program_id
      if (programId) {
        const { data: program } = await supabase.from("programs").select("program_name").eq("id", programId).maybeSingle()
        programName = (program as { program_name?: string })?.program_name ?? null
      }
    }
  }

  return {
    playerId: profileRow.player_id,
    slug: profileRow.slug,
    programId: profileRow.program_id,
    teamId: profileRow.team_id ?? teamId ?? null,
    graduationYear: profileRow.graduation_year,
    heightFeet: profileRow.height_feet,
    heightInches: profileRow.height_inches,
    weightLbs: profileRow.weight_lbs,
    fortyTime: profileRow.forty_time != null ? Number(profileRow.forty_time) : null,
    shuttleTime: profileRow.shuttle_time != null ? Number(profileRow.shuttle_time) : null,
    verticalJump: profileRow.vertical_jump != null ? Number(profileRow.vertical_jump) : null,
    gpa: profileRow.gpa != null ? Number(profileRow.gpa) : null,
    recruitingVisibility: profileRow.recruiting_visibility,
    statsVisible: profileRow.stats_visible,
    coachNotesVisible: profileRow.coach_notes_visible,
    playbookMasteryVisible: profileRow.playbook_mastery_visible,
    developmentVisible: profileRow.development_visible,
    bio: profileRow.bio,
    xHandle: profileRow.x_handle,
    instagramHandle: profileRow.instagram_handle,
    hudlUrl: profileRow.hudl_url,
    youtubeUrl: profileRow.youtube_url,
    createdAt: profileRow.created_at,
    updatedAt: profileRow.updated_at,
    firstName: (player as { first_name?: string }).first_name ?? "",
    lastName: (player as { last_name?: string }).last_name ?? "",
    positionGroup: (player as { position_group?: string }).position_group ?? null,
    jerseyNumber: (player as { jersey_number?: number }).jersey_number ?? null,
    teamName,
    teamLevel,
    programName,
  }
}

export interface PublicRecruitingPageData extends RecruitingProfileView {
  videoLinks: Array<{ videoType: string; url: string; sortOrder: number }>
  statsSummary: Record<string, unknown> | null
  coachNotes: string | null
  playbookMasteryPct: number | null
  developmentSummary: {
    strength: number | null
    speed: number | null
    footballIq: number | null
    leadership: number | null
    discipline: number | null
  } | null
}

/**
 * Full public recruiting page data: base profile + visible sections (video links always; stats/coach notes/mastery/development per flags).
 */
export async function getPublicRecruitingPageData(
  supabase: SupabaseClient,
  playerIdOrSlug: string
): Promise<PublicRecruitingPageData | null> {
  const base = await getRecruitingProfileByPlayerIdOrSlug(supabase, playerIdOrSlug, { requireVisible: true })
  if (!base) return null

  const playerId = base.playerId
  const programId = base.programId

  const [videoRes, playerRes, evalRes, devRes, knowledgeRes, assignmentsRes] = await Promise.all([
    supabase.from("player_video_links").select("video_type, url, sort_order").eq("player_id", playerId).order("sort_order"),
    base.statsVisible || base.coachNotesVisible ? supabase.from("players").select("season_stats, coach_notes").eq("id", playerId).maybeSingle() : Promise.resolve({ data: null }),
    base.coachNotesVisible ? supabase.from("player_evaluations").select("coach_notes").eq("player_id", playerId).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    base.developmentVisible ? supabase.from("player_development_metrics").select("strength_score, speed_score, football_iq_score, leadership_score, discipline_score").eq("player_id", playerId).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    base.playbookMasteryVisible && programId ? supabase.from("player_play_knowledge").select("status").eq("player_id", playerId).eq("program_id", programId) : Promise.resolve({ data: [] }),
    base.playbookMasteryVisible && programId ? supabase.from("play_assignments").select("id").eq("program_id", programId) : Promise.resolve({ data: [] }),
  ])

  const videoLinks = (videoRes.data ?? []).map((r: { video_type: string; url: string; sort_order: number }) => ({
    videoType: r.video_type,
    url: r.url,
    sortOrder: r.sort_order,
  }))

  let statsSummary: Record<string, unknown> | null = null
  let coachNotes: string | null = null
  if (playerRes.data && base.statsVisible) {
    statsSummary = (playerRes.data as { season_stats?: Record<string, unknown> }).season_stats ?? null
  }
  if (base.coachNotesVisible) {
    const evalNotes = (evalRes.data as { coach_notes?: string } | null)?.coach_notes
    const playerNotes = (playerRes.data as { coach_notes?: string } | null)?.coach_notes
    coachNotes = evalNotes ?? playerNotes ?? null
  }

  let playbookMasteryPct: number | null = null
  if (base.playbookMasteryVisible && programId && assignmentsRes.data && knowledgeRes.data) {
    const total = (assignmentsRes.data as unknown[]).length
    const completed = (knowledgeRes.data as { status: string }[]).filter((k) => k.status === "quiz_passed" || k.status === "completed").length
    playbookMasteryPct = total > 0 ? Math.round((completed / total) * 100) : null
  }

  let developmentSummary: PublicRecruitingPageData["developmentSummary"] = null
  if (base.developmentVisible && devRes.data) {
    const d = devRes.data as {
      strength_score?: number
      speed_score?: number
      football_iq_score?: number
      leadership_score?: number
      discipline_score?: number
    }
    developmentSummary = {
      strength: d.strength_score ?? null,
      speed: d.speed_score ?? null,
      footballIq: d.football_iq_score ?? null,
      leadership: d.leadership_score ?? null,
      discipline: d.discipline_score ?? null,
    }
  }

  return {
    ...base,
    videoLinks,
    statsSummary,
    coachNotes,
    playbookMasteryPct,
    developmentSummary,
  }
}
