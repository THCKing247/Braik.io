import type { SupabaseClient } from "@supabase/supabase-js"

export interface RecruitingReport {
  playerId: string
  firstName: string
  lastName: string
  positionGroup: string | null
  jerseyNumber: number | null
  graduationYear: number | null
  currentTeamName: string | null
  currentTeamLevel: string | null
  programName: string | null
  recruitingProfile: {
    heightFeet: number | null
    heightInches: number | null
    weightLbs: number | null
    fortyTime: number | null
    gpa: number | null
    bio: string | null
    hudlUrl: string | null
    youtubeUrl: string | null
  } | null
  promotionHistory: Array<{
    fromLevel: string | null
    toLevel: string
    season: string | null
    promotionReason: string | null
    createdAt: string
  }>
  careerStats: Record<string, unknown>
  developmentSummary: {
    latestStrength: number | null
    latestSpeed: number | null
    latestFootballIq: number | null
    latestLeadership: number | null
    latestDiscipline: number | null
    coachNotes: string | null
    loggedAt: string | null
  } | null
  playbookMasterySummary: {
    completedCount: number
    totalAssigned: number
    masteryPct: number
  } | null
  latestEvaluation: {
    practiceGrade: string | null
    effortGrade: string | null
    playbookMastery: string | null
    coachNotes: string | null
    createdAt: string
  } | null
  coachNotes: string | null
  videoLinks: Array<{ videoType: string; url: string; sortOrder: number }>
  recruiterInterest: Array<{
    schoolName: string
    coachName: string | null
    status: string
    notes: string | null
    updatedAt: string
  }>
}

/**
 * Build a recruiting report for a player. Caller must enforce program access.
 */
export async function getRecruitingReport(
  supabase: SupabaseClient,
  playerId: string
): Promise<RecruitingReport | null> {
  const { data: player } = await supabase
    .from("players")
    .select("id, first_name, last_name, position_group, jersey_number, team_id, graduation_year, season_stats, game_stats, coach_notes")
    .eq("id", playerId)
    .maybeSingle()

  if (!player) return null

  const teamId = (player as { team_id: string }).team_id
  const { data: team } = await supabase.from("teams").select("id, name, team_level, program_id").eq("id", teamId).maybeSingle()
  const programId = team ? (team as { program_id?: string }).program_id : null
  let programName: string | null = null
  if (programId) {
    const { data: program } = await supabase.from("programs").select("program_name").eq("id", programId).maybeSingle()
    programName = (program as { program_name?: string })?.program_name ?? null
  }

  const { data: profile } = await supabase
    .from("player_recruiting_profiles")
    .select("height_feet, height_inches, weight_lbs, forty_time, gpa, bio, hudl_url, youtube_url")
    .eq("player_id", playerId)
    .maybeSingle()

  const { data: history } = await supabase
    .from("player_team_history")
    .select("from_level, to_level, season, promotion_reason, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })

  const { data: devRows } = await supabase
    .from("player_development_metrics")
    .select("strength_score, speed_score, football_iq_score, leadership_score, discipline_score, coach_notes, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(1)

  const latestDev = devRows?.[0]

  let playbookMasterySummary: RecruitingReport["playbookMasterySummary"] = null
  if (programId) {
    const { data: assignments } = await supabase
      .from("play_assignments")
      .select("id")
      .eq("program_id", programId)
    const totalAssigned = (assignments ?? []).length
    const { data: knowledge } = await supabase
      .from("player_play_knowledge")
      .select("status")
      .eq("player_id", playerId)
      .eq("program_id", programId)
    const completed = (knowledge ?? []).filter((k) => k.status === "quiz_passed" || k.status === "completed").length
    playbookMasterySummary = {
      completedCount: completed,
      totalAssigned,
      masteryPct: totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0,
    }
  }

  const { data: evalRows } = await supabase
    .from("player_evaluations")
    .select("practice_grade, effort_grade, playbook_mastery, coach_notes, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(1)
  const latestEval = evalRows?.[0]

  const { data: videoRows } = await supabase
    .from("player_video_links")
    .select("video_type, url, sort_order")
    .eq("player_id", playerId)
    .order("sort_order")

  const { data: interestRows } = await supabase
    .from("player_recruiter_interest")
    .select("school_name, coach_name, status, notes, updated_at")
    .eq("player_id", playerId)
    .order("updated_at", { ascending: false })

  const careerStats = (player as { season_stats?: Record<string, unknown> }).season_stats ?? {}

  return {
    playerId: (player as { id: string }).id,
    firstName: (player as { first_name?: string }).first_name ?? "",
    lastName: (player as { last_name?: string }).last_name ?? "",
    positionGroup: (player as { position_group?: string }).position_group ?? null,
    jerseyNumber: (player as { jersey_number?: number }).jersey_number ?? null,
    graduationYear: (player as { graduation_year?: number }).graduation_year ?? (profile as { graduation_year?: number } | null)?.graduation_year ?? null,
    currentTeamName: team ? (team as { name?: string }).name ?? null : null,
    currentTeamLevel: team ? (team as { team_level?: string }).team_level ?? null : null,
    programName,
    recruitingProfile: profile
      ? {
          heightFeet: (profile as { height_feet?: number }).height_feet ?? null,
          heightInches: (profile as { height_inches?: number }).height_inches ?? null,
          weightLbs: (profile as { weight_lbs?: number }).weight_lbs ?? null,
          fortyTime: (profile as { forty_time?: number }).forty_time != null ? Number((profile as { forty_time?: number }).forty_time) : null,
          gpa: (profile as { gpa?: number }).gpa != null ? Number((profile as { gpa?: number }).gpa) : null,
          bio: (profile as { bio?: string }).bio ?? null,
          hudlUrl: (profile as { hudl_url?: string }).hudl_url ?? null,
          youtubeUrl: (profile as { youtube_url?: string }).youtube_url ?? null,
        }
      : null,
    promotionHistory: (history ?? []).map((h) => ({
      fromLevel: (h as { from_level?: string }).from_level ?? null,
      toLevel: (h as { to_level: string }).to_level,
      season: (h as { season?: string }).season ?? null,
      promotionReason: (h as { promotion_reason?: string }).promotion_reason ?? null,
      createdAt: (h as { created_at: string }).created_at,
    })),
    careerStats,
    developmentSummary: latestDev
      ? {
          latestStrength: (latestDev as { strength_score?: number }).strength_score ?? null,
          latestSpeed: (latestDev as { speed_score?: number }).speed_score ?? null,
          latestFootballIq: (latestDev as { football_iq_score?: number }).football_iq_score ?? null,
          latestLeadership: (latestDev as { leadership_score?: number }).leadership_score ?? null,
          latestDiscipline: (latestDev as { discipline_score?: number }).discipline_score ?? null,
          coachNotes: (latestDev as { coach_notes?: string }).coach_notes ?? null,
          loggedAt: (latestDev as { created_at?: string }).created_at ?? null,
        }
      : null,
    playbookMasterySummary,
    latestEvaluation: latestEval
      ? {
          practiceGrade: (latestEval as { practice_grade?: string }).practice_grade ?? null,
          effortGrade: (latestEval as { effort_grade?: string }).effort_grade ?? null,
          playbookMastery: (latestEval as { playbook_mastery?: string }).playbook_mastery ?? null,
          coachNotes: (latestEval as { coach_notes?: string }).coach_notes ?? null,
          createdAt: (latestEval as { created_at: string }).created_at,
        }
      : null,
    coachNotes: (player as { coach_notes?: string }).coach_notes ?? null,
    videoLinks: (videoRows ?? []).map((r) => ({
      videoType: (r as { video_type: string }).video_type,
      url: (r as { url: string }).url,
      sortOrder: (r as { sort_order: number }).sort_order,
    })),
    recruiterInterest: (interestRows ?? []).map((r) => ({
      schoolName: (r as { school_name: string }).school_name,
      coachName: (r as { coach_name?: string }).coach_name ?? null,
      status: (r as { status: string }).status,
      notes: (r as { notes?: string }).notes ?? null,
      updatedAt: (r as { updated_at: string }).updated_at,
    })),
  }
}
