import type { SupabaseClient } from "@supabase/supabase-js"

export interface ProgramOverview {
  programId: string
  programName: string
  rosterByLevel: { teamLevel: string; teamId: string; teamName: string; count: number }[]
  totalRoster: number
  totalCoaches: number
  averagePlaybookMasteryPct: number | null
  playersWithRecentDevelopmentLogs: number
  recruitingVisibleCount: number
  playersWithRecruiterInterest: number
}

export interface BreakoutCandidate {
  playerId: string
  playerName: string
  teamLevel: string | null
  positionGroup: string | null
  score: number
  explanation: string
}

export interface PromotionCandidate {
  playerId: string
  playerName: string
  currentLevel: string
  positionGroup: string | null
  score: number
  explanation: string
}

export interface PlaybookReadiness {
  offenseReadinessPct: number | null
  defenseReadinessPct: number | null
  specialTeamsReadinessPct: number | null
  lowestReadinessPositionGroups: { positionGroup: string; avgPct: number; playerCount: number }[]
  playersBehindOnAssignments: { playerId: string; playerName: string; completed: number; total: number; pct: number }[]
}

export interface RecruitingReadyPlayer {
  playerId: string
  playerName: string
  teamLevel: string | null
  positionGroup: string | null
  score: number
  hasVisibility: boolean
  hasVideoLinks: boolean
  hasEvaluations: boolean
  explanation: string
}

export interface ProgramRisk {
  type: string
  severity: "high" | "medium" | "low"
  title: string
  explanation: string
  linkToPlayerId?: string
  linkToTeamId?: string
}

const GRADE_SCORE: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, F: 50 }

function gradeToScore(grade: string | null): number {
  if (!grade || !String(grade).trim()) return 0
  const g = String(grade).trim().toUpperCase().slice(0, 1)
  return GRADE_SCORE[g] ?? 50
}

/**
 * 1. Program overview: roster by level, coaches, avg playbook mastery, development logs, recruiting visibility, interest.
 */
export async function getProgramOverview(supabase: SupabaseClient, programId: string): Promise<ProgramOverview | null> {
  const { data: program } = await supabase.from("programs").select("id, program_name").eq("id", programId).maybeSingle()
  if (!program) return null

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, team_level")
    .eq("program_id", programId)
    .in("team_level", ["varsity", "jv", "freshman"])

  const teamIds = (teams ?? []).map((t) => t.id)
  const rosterByLevel: ProgramOverview["rosterByLevel"] = []
  let totalRoster = 0
  for (const t of teams ?? []) {
    const { count } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("team_id", t.id)
    const c = count ?? 0
    totalRoster += c
    rosterByLevel.push({
      teamLevel: (t as { team_level?: string }).team_level ?? "varsity",
      teamId: t.id,
      teamName: (t as { name?: string }).name ?? "",
      count: c,
    })
  }

  const { count: coachCount } = await supabase
    .from("program_members")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId)
    .in("role", ["head_coach", "director_of_football", "assistant_coach", "athletic_director"])
  const totalCoaches = coachCount ?? 0

  const { data: assignments } = await supabase.from("play_assignments").select("id").eq("program_id", programId)
  const totalAssigned = (assignments ?? []).length
  let averagePlaybookMasteryPct: number | null = null
  if (totalAssigned > 0 && teamIds.length > 0) {
    const { data: players } = await supabase.from("players").select("id").in("team_id", teamIds)
    const playerIds = (players ?? []).map((p) => p.id)
    if (playerIds.length > 0) {
      const { data: knowledge } = await supabase
        .from("player_play_knowledge")
        .select("player_id, status")
        .eq("program_id", programId)
        .in("player_id", playerIds)
      const completedByPlayer = new Map<string, number>()
      for (const k of knowledge ?? []) {
        if (k.player_id)
          completedByPlayer.set(k.player_id, (completedByPlayer.get(k.player_id) ?? 0) + (k.status === "quiz_passed" || k.status === "completed" ? 1 : 0))
      }
      let sum = 0
      let n = 0
      for (const pid of playerIds) {
        const completed = completedByPlayer.get(pid) ?? 0
        const pct = Math.round((completed / totalAssigned) * 100)
        sum += pct
        n++
      }
      averagePlaybookMasteryPct = n > 0 ? Math.round(sum / n) : null
    }
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const iso = thirtyDaysAgo.toISOString()
  const { count: devCount } = await supabase
    .from("player_development_metrics")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId)
    .gte("created_at", iso)
  const playersWithRecentDevelopmentLogs = devCount ?? 0

  const { count: visibleCount } = await supabase
    .from("player_recruiting_profiles")
    .select("player_id", { count: "exact", head: true })
    .eq("recruiting_visibility", true)
  const recruitingVisibleCount = visibleCount ?? 0

  const { data: interestRows } = await supabase
    .from("player_recruiter_interest")
    .select("player_id")
    .neq("status", "closed")
  const uniquePlayersWithInterest = new Set((interestRows ?? []).map((r) => r.player_id))
  const playersWithRecruiterInterest = uniquePlayersWithInterest.size

  return {
    programId,
    programName: (program as { program_name?: string }).program_name ?? "",
    rosterByLevel,
    totalRoster,
    totalCoaches,
    averagePlaybookMasteryPct,
    playersWithRecentDevelopmentLogs,
    recruitingVisibleCount,
    playersWithRecruiterInterest,
  }
}

/**
 * 2. Breakout candidates: rank by development trend, evaluation trend, production, promotion momentum, playbook mastery.
 */
export async function getPlayerBreakoutCandidates(
  supabase: SupabaseClient,
  programId: string,
  limit = 5
): Promise<BreakoutCandidate[]> {
  const { data: teams } = await supabase
    .from("teams")
    .select("id, team_level")
    .eq("program_id", programId)
  const teamIds = (teams ?? []).map((t) => t.id)
  if (teamIds.length === 0) return []

  const { data: players } = await supabase.from("players").select("id, first_name, last_name, team_id, position_group").in("team_id", teamIds)
  if (!players?.length) return []

  const playerIds = players.map((p) => p.id)
  const teamLevelById = new Map((teams ?? []).map((t) => [t.id, (t as { team_level?: string }).team_level ?? null]))

  const { data: evals } = await supabase
    .from("player_evaluations")
    .select("player_id, practice_grade, playbook_mastery, created_at")
    .eq("program_id", programId)
    .in("player_id", playerIds)
    .order("created_at", { ascending: false })
  const latestEvalByPlayer = new Map<string, { practice_grade: string | null; playbook_mastery: string | null }>()
  for (const e of evals ?? []) {
    if (e.player_id && !latestEvalByPlayer.has(e.player_id)) {
      latestEvalByPlayer.set(e.player_id, {
        practice_grade: (e as { practice_grade?: string }).practice_grade ?? null,
        playbook_mastery: (e as { playbook_mastery?: string }).playbook_mastery ?? null,
      })
    }
  }

  const { data: devRows } = await supabase
    .from("player_development_metrics")
    .select("player_id, strength_score, speed_score, football_iq_score, created_at")
    .eq("program_id", programId)
    .in("player_id", playerIds)
    .order("created_at", { ascending: false })
  const latestDevByPlayer = new Map<string, { score: number }>()
  for (const d of devRows ?? []) {
    if (d.player_id && !latestDevByPlayer.has(d.player_id)) {
      const s =
        ((d as { strength_score?: number }).strength_score ?? 0) +
        ((d as { speed_score?: number }).speed_score ?? 0) +
        ((d as { football_iq_score?: number }).football_iq_score ?? 0)
      latestDevByPlayer.set(d.player_id, { score: s })
    }
  }

  const { data: history } = await supabase
    .from("player_team_history")
    .select("player_id, to_level, created_at")
    .eq("program_id", programId)
    .in("player_id", playerIds)
    .order("created_at", { ascending: false })
  const recentPromoByPlayer = new Map<string, string>()
  for (const h of history ?? []) {
    if (h.player_id && !recentPromoByPlayer.has(h.player_id)) {
      recentPromoByPlayer.set(h.player_id, (h as { to_level: string }).to_level)
    }
  }

  const { data: assignments } = await supabase.from("play_assignments").select("id").eq("program_id", programId)
  const totalAssigned = (assignments ?? []).length
  const { data: knowledge } = await supabase
    .from("player_play_knowledge")
    .select("player_id, status")
    .eq("program_id", programId)
    .in("player_id", playerIds)
  const completedByPlayer = new Map<string, number>()
  for (const k of knowledge ?? []) {
    if (k.player_id)
      completedByPlayer.set(k.player_id, (completedByPlayer.get(k.player_id) ?? 0) + (k.status === "quiz_passed" || k.status === "completed" ? 1 : 0))
  }

  const scored: { player: (typeof players)[0]; score: number; explanation: string }[] = players.map((player) => {
    const ev = latestEvalByPlayer.get(player.id)
    const dev = latestDevByPlayer.get(player.id)
    const promo = recentPromoByPlayer.get(player.id)
    const completed = completedByPlayer.get(player.id) ?? 0
    const masteryPct = totalAssigned > 0 ? (completed / totalAssigned) * 100 : 0
    const evalScore = (gradeToScore(ev?.practice_grade ?? null) + gradeToScore(ev?.playbook_mastery ?? null)) / 2
    const devScore = dev ? dev.score / 3 : 50
    const promoBonus = promo === "varsity" ? 15 : promo ? 5 : 0
    const score = evalScore * 0.35 + devScore * 0.35 + masteryPct * 0.2 + promoBonus
    const parts: string[] = []
    if (ev?.practice_grade) parts.push(`Practice: ${ev.practice_grade}`)
    if (ev?.playbook_mastery) parts.push(`Playbook: ${ev.playbook_mastery}`)
    if (masteryPct > 0) parts.push(`${Math.round(masteryPct)}% playbook`)
    if (promo) parts.push(`Recent move to ${promo}`)
    return {
      player,
      score,
      explanation: parts.length > 0 ? parts.join(" · ") : "Building momentum",
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => ({
    playerId: (s.player as { id: string }).id,
    playerName: `${(s.player as { first_name?: string }).first_name ?? ""} ${(s.player as { last_name?: string }).last_name ?? ""}`.trim() || "Unknown",
    teamLevel: teamLevelById.get((s.player as { team_id: string }).team_id) ?? null,
    positionGroup: (s.player as { position_group?: string }).position_group ?? null,
    score: Math.round(s.score),
    explanation: s.explanation,
  }))
}

/**
 * 3. Promotion candidates: JV/Freshman players ranked by depth chart standing, evaluations, playbook mastery, stats, development.
 */
export async function getPromotionCandidates(
  supabase: SupabaseClient,
  programId: string,
  limit = 5
): Promise<PromotionCandidate[]> {
  const { data: teams } = await supabase
    .from("teams")
    .select("id, team_level")
    .eq("program_id", programId)
    .in("team_level", ["jv", "freshman"])
  const teamIds = (teams ?? []).map((t) => t.id)
  if (teamIds.length === 0) return []

  const { data: players } = await supabase.from("players").select("id, first_name, last_name, team_id, position_group").in("team_id", teamIds)
  if (!players?.length) return []

  const playerIds = players.map((p) => p.id)
  const teamLevelById = new Map((teams ?? []).map((t) => [t.id, (t as { team_level?: string }).team_level ?? ""]))

  const { data: evals } = await supabase
    .from("player_evaluations")
    .select("player_id, practice_grade, playbook_mastery")
    .eq("program_id", programId)
    .in("player_id", playerIds)
    .order("created_at", { ascending: false })
  const latestEval = new Map<string, { practice_grade: string | null; playbook_mastery: string | null }>()
  for (const e of evals ?? []) {
    if (e.player_id && !latestEval.has(e.player_id)) {
      latestEval.set(e.player_id, {
        practice_grade: (e as { practice_grade?: string }).practice_grade ?? null,
        playbook_mastery: (e as { playbook_mastery?: string }).playbook_mastery ?? null,
      })
    }
  }

  const { data: assignments } = await supabase.from("play_assignments").select("id").eq("program_id", programId)
  const totalAssigned = (assignments ?? []).length
  const { data: knowledge } = await supabase
    .from("player_play_knowledge")
    .select("player_id, status")
    .eq("program_id", programId)
    .in("player_id", playerIds)
  const completedByPlayer = new Map<string, number>()
  for (const k of knowledge ?? []) {
    if (k.player_id)
      completedByPlayer.set(k.player_id, (completedByPlayer.get(k.player_id) ?? 0) + (k.status === "quiz_passed" || k.status === "completed" ? 1 : 0))
  }

  const scored: { player: (typeof players)[0]; score: number; explanation: string }[] = players.map((player) => {
    const ev = latestEval.get(player.id)
    const completed = completedByPlayer.get(player.id) ?? 0
    const masteryPct = totalAssigned > 0 ? (completed / totalAssigned) * 100 : 0
    const evalScore = (gradeToScore(ev?.practice_grade ?? null) + gradeToScore(ev?.playbook_mastery ?? null)) / 2
    const score = evalScore * 0.5 + masteryPct * 0.5
    const parts: string[] = []
    if (ev?.practice_grade) parts.push(ev.practice_grade)
    if (ev?.playbook_mastery) parts.push(`Playbook: ${ev.playbook_mastery}`)
    if (masteryPct > 0) parts.push(`${Math.round(masteryPct)}% mastery`)
    return {
      player,
      score,
      explanation: parts.length > 0 ? parts.join(" · ") : "Ready for consideration",
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => ({
    playerId: (s.player as { id: string }).id,
    playerName: `${(s.player as { first_name?: string }).first_name ?? ""} ${(s.player as { last_name?: string }).last_name ?? ""}`.trim() || "Unknown",
    currentLevel: teamLevelById.get((s.player as { team_id: string }).team_id) ?? "jv",
    positionGroup: (s.player as { position_group?: string }).position_group ?? null,
    score: Math.round(s.score),
    explanation: s.explanation,
  }))
}

/**
 * 4. Playbook readiness: offense/defense/special teams %, lowest groups, players behind.
 */
export async function getPlaybookReadiness(supabase: SupabaseClient, programId: string): Promise<PlaybookReadiness> {
  const { data: teams } = await supabase.from("teams").select("id, team_level").eq("program_id", programId)
  const teamIds = (teams ?? []).map((t) => t.id)
  const { data: assignments } = await supabase.from("play_assignments").select("id, team_level").eq("program_id", programId)
  const totalByLevel = new Map<string, number>()
  for (const a of assignments ?? []) {
    const level = (a as { team_level?: string }).team_level ?? ""
    totalByLevel.set(level, (totalByLevel.get(level) ?? 0) + 1)
  }

  const { data: players } = await supabase.from("players").select("id, first_name, last_name, team_id, position_group").in("team_id", teamIds)
  const playerIds = (players ?? []).map((p) => p.id)
  const { data: knowledge } = await supabase
    .from("player_play_knowledge")
    .select("player_id, status")
    .eq("program_id", programId)
    .in("player_id", playerIds)
  const completedByPlayer = new Map<string, number>()
  for (const k of knowledge ?? []) {
    if (k.player_id)
      completedByPlayer.set(k.player_id, (completedByPlayer.get(k.player_id) ?? 0) + (k.status === "quiz_passed" || k.status === "completed" ? 1 : 0))
  }

  const teamLevelById = new Map((teams ?? []).map((t) => [t.id, (t as { team_level?: string }).team_level ?? ""]))
  let offenseReadinessPct: number | null = null
  let defenseReadinessPct: number | null = null
  let specialTeamsReadinessPct: number | null = null
  const totalVarsity = totalByLevel.get("varsity") ?? 0
  const totalJv = totalByLevel.get("jv") ?? 0
  const totalFreshman = totalByLevel.get("freshman") ?? 0
  if (totalVarsity > 0) {
    const varsityTeam = (teams ?? []).find((t) => (t as { team_level?: string }).team_level === "varsity")
    if (varsityTeam) {
      const { data: varsityPlayers } = await supabase.from("players").select("id").eq("team_id", varsityTeam.id)
      let sum = 0
      let n = 0
      for (const p of varsityPlayers ?? []) {
        const completed = completedByPlayer.get(p.id) ?? 0
        sum += (completed / totalVarsity) * 100
        n++
      }
      offenseReadinessPct = defenseReadinessPct = specialTeamsReadinessPct = n > 0 ? Math.round(sum / n) : null
    }
  }
  if (offenseReadinessPct == null && totalByLevel.size > 0) {
    let sum = 0
    let n = 0
    for (const pid of playerIds) {
      const completed = completedByPlayer.get(pid) ?? 0
      const total = totalVarsity + totalJv + totalFreshman
      if (total > 0) {
        sum += (completed / total) * 100
        n++
      }
    }
    const avg = n > 0 ? Math.round(sum / n) : 0
    offenseReadinessPct = defenseReadinessPct = specialTeamsReadinessPct = avg
  }

  const byPosition = new Map<string, { sumPct: number; count: number }>()
  for (const p of players ?? []) {
    const pos = (p as { position_group?: string }).position_group ?? "Other"
    const total = totalByLevel.get(teamLevelById.get((p as { team_id: string }).team_id) ?? "") ?? totalVarsity + totalJv + totalFreshman
    const completed = completedByPlayer.get(p.id) ?? 0
    const pct = total > 0 ? (completed / total) * 100 : 0
    const cur = byPosition.get(pos) ?? { sumPct: 0, count: 0 }
    byPosition.set(pos, {
      sumPct: cur.sumPct + pct,
      count: cur.count + 1,
    })
  }
  const lowestReadinessPositionGroups = [...byPosition.entries()]
    .map(([positionGroup, v]) => ({
      positionGroup,
      avgPct: v.count > 0 ? Math.round(v.sumPct / v.count) : 0,
      playerCount: v.count,
    }))
    .sort((a, b) => a.avgPct - b.avgPct)
    .slice(0, 5)

  const totalAssigned = totalVarsity + totalJv + totalFreshman
  const playersBehindOnAssignments = (players ?? [])
    .map((p) => {
      const completed = completedByPlayer.get(p.id) ?? 0
      const pct = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0
      return {
        playerId: p.id,
        playerName: `${(p as { first_name?: string }).first_name ?? ""} ${(p as { last_name?: string }).last_name ?? ""}`.trim() || "Unknown",
        completed,
        total: totalAssigned,
        pct,
      }
    })
    .filter((x) => x.pct < 50)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 10)

  return {
    offenseReadinessPct,
    defenseReadinessPct,
    specialTeamsReadinessPct,
    lowestReadinessPositionGroups,
    playersBehindOnAssignments,
  }
}

/**
 * 5. Recruiting-ready players: production, measurables, development, visibility, evaluations, video links.
 */
export async function getRecruitingReadyPlayers(
  supabase: SupabaseClient,
  programId: string,
  limit = 10
): Promise<RecruitingReadyPlayer[]> {
  const { data: teams } = await supabase.from("teams").select("id, team_level").eq("program_id", programId)
  const teamIds = (teams ?? []).map((t) => t.id)
  if (teamIds.length === 0) return []

  const { data: players } = await supabase.from("players").select("id, first_name, last_name, team_id, position_group").in("team_id", teamIds)
  if (!players?.length) return []

  const playerIds = players.map((p) => p.id)
  const teamLevelById = new Map((teams ?? []).map((t) => [t.id, (t as { team_level?: string }).team_level ?? null]))

  const { data: profiles } = await supabase
    .from("player_recruiting_profiles")
    .select("player_id, recruiting_visibility")
    .in("player_id", playerIds)
  const visibilityByPlayer = new Map((profiles ?? []).map((p) => [p.player_id, (p as { recruiting_visibility?: boolean }).recruiting_visibility === true]))

  const { data: videoRows } = await supabase.from("player_video_links").select("player_id").in("player_id", playerIds)
  const hasVideoByPlayer = new Map<string, boolean>()
  for (const v of videoRows ?? []) {
    if (v.player_id) hasVideoByPlayer.set(v.player_id, true)
  }

  const { data: evals } = await supabase
    .from("player_evaluations")
    .select("player_id")
    .eq("program_id", programId)
    .in("player_id", playerIds)
  const hasEvalByPlayer = new Set((evals ?? []).map((e) => e.player_id))

  const scored: { player: (typeof players)[0]; score: number; explanation: string }[] = players.map((player) => {
    const visible = visibilityByPlayer.get(player.id) ?? false
    const hasVideo = hasVideoByPlayer.get(player.id) ?? false
    const hasEval = hasEvalByPlayer.has(player.id)
    let score = 0
    const parts: string[] = []
    if (visible) {
      score += 30
      parts.push("Profile visible")
    }
    if (hasVideo) {
      score += 25
      parts.push("Film links")
    }
    if (hasEval) {
      score += 25
      parts.push("Coach eval")
    }
    score += 20
    parts.push("In program")
    return {
      player,
      score,
      explanation: parts.join(" · "),
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => ({
    playerId: (s.player as { id: string }).id,
    playerName: `${(s.player as { first_name?: string }).first_name ?? ""} ${(s.player as { last_name?: string }).last_name ?? ""}`.trim() || "Unknown",
    teamLevel: teamLevelById.get((s.player as { team_id: string }).team_id) ?? null,
    positionGroup: (s.player as { position_group?: string }).position_group ?? null,
    score: s.score,
    hasVisibility: visibilityByPlayer.get((s.player as { id: string }).id) ?? false,
    hasVideoLinks: hasVideoByPlayer.get((s.player as { id: string }).id) ?? false,
    hasEvaluations: hasEvalByPlayer.has((s.player as { id: string }).id),
    explanation: s.explanation,
  }))
}

/**
 * 6. Program risks: shallow depth, unlinked players, low playbook completion, no pipeline, over-reliance on one player.
 */
export async function getProgramRisks(supabase: SupabaseClient, programId: string): Promise<ProgramRisk[]> {
  const risks: ProgramRisk[] = []

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, team_level")
    .eq("program_id", programId)
    .in("team_level", ["varsity", "jv", "freshman"])

  const teamIds = (teams ?? []).map((t) => t.id)
  const { data: players } = await supabase.from("players").select("id, team_id, position_group").in("team_id", teamIds)
  const rosterByTeam = new Map<string, number>()
  for (const p of players ?? []) {
    const tid = (p as { team_id: string }).team_id
    rosterByTeam.set(tid, (rosterByTeam.get(tid) ?? 0) + 1)
  }
  for (const t of teams ?? []) {
    const count = rosterByTeam.get(t.id) ?? 0
    if (count < 5 && (t as { team_level?: string }).team_level === "varsity") {
      risks.push({
        type: "shallow_depth",
        severity: "high",
        title: "Low varsity roster count",
        explanation: `Varsity has only ${count} players. Consider call-ups or roster health.`,
        linkToTeamId: t.id,
      })
    }
  }

  const { data: assignments } = await supabase.from("play_assignments").select("id").eq("program_id", programId)
  const totalAssigned = (assignments ?? []).length
  const playerIds = (players ?? []).map((p) => p.id)
  const { data: knowledge } = await supabase
    .from("player_play_knowledge")
    .select("player_id, status")
    .eq("program_id", programId)
    .in("player_id", playerIds)
  const completedByPlayer = new Map<string, number>()
  for (const k of knowledge ?? []) {
    if (k.player_id)
      completedByPlayer.set(k.player_id, (completedByPlayer.get(k.player_id) ?? 0) + (k.status === "quiz_passed" || k.status === "completed" ? 1 : 0))
  }
  let belowFifty = 0
  for (const pid of playerIds) {
    const completed = completedByPlayer.get(pid) ?? 0
    const pct = totalAssigned > 0 ? (completed / totalAssigned) * 100 : 0
    if (pct < 50) belowFifty++
  }
  if (totalAssigned > 0 && belowFifty > playerIds.length * 0.5) {
    risks.push({
      type: "low_playbook_completion",
      severity: "medium",
      title: "Low playbook readiness",
      explanation: `${belowFifty} players are below 50% playbook completion.`,
    })
  }

  const { data: profiles } = await supabase
    .from("player_recruiting_profiles")
    .select("player_id")
    .eq("program_id", programId)
    .eq("recruiting_visibility", true)
  const visibleCount = (profiles ?? []).length
  if (playerIds.length > 10 && visibleCount === 0) {
    risks.push({
      type: "no_recruiting_profiles",
      severity: "low",
      title: "No recruiting profiles visible",
      explanation: "No players have recruiting visibility enabled. Consider enabling for standout players.",
    })
  }

  const positionCount = new Map<string, number>()
  for (const p of players ?? []) {
    const pos = (p as { position_group?: string }).position_group ?? "Other"
    positionCount.set(pos, (positionCount.get(pos) ?? 0) + 1)
  }
  for (const [pos, count] of positionCount) {
    if (count === 1) {
      risks.push({
        type: "single_player_position",
        severity: "medium",
        title: `Only one player at ${pos}`,
        explanation: `Depth at ${pos} is minimal. Injury or absence could create a gap.`,
      })
    }
  }

  return risks
}
