import type { SupabaseClient } from "@supabase/supabase-js"

export interface CallUpSuggestion {
  playerId: string
  playerName: string
  currentLevel: "jv" | "freshman"
  practiceGrade: string | null
  playbookMastery: string | null
  recentStatsSummary: string | null
  reason: string
}

const POSITION_GROUP_MAP: Record<string, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  OL: ["OL"],
  DL: ["DL"],
  LB: ["LB"],
  DB: ["DB"],
  K: ["K"],
  P: ["P"],
}

function positionToGroups(position: string): string[] {
  const upper = position.trim().toUpperCase()
  return POSITION_GROUP_MAP[upper] ?? [upper]
}

/** Parse grade to numeric for sorting (A=95, B=85, C=75, etc.). */
function gradeScore(grade: string | null): number {
  if (!grade || !grade.trim()) return 0
  const g = grade.trim().toUpperCase().slice(0, 1)
  const map: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, F: 50 }
  return map[g] ?? 50
}

/**
 * Get top call-up suggestions for a program/position: JV or Freshman players
 * who could fill a varsity need, ranked by practice grade, playbook mastery, and recent activity.
 */
export async function getCallUpSuggestions(
  supabase: SupabaseClient,
  programId: string,
  position: string,
  limit = 3
): Promise<CallUpSuggestion[]> {
  const positionGroups = positionToGroups(position)
  if (positionGroups.length === 0) return []

  const { data: teams } = await supabase
    .from("teams")
    .select("id, team_level")
    .eq("program_id", programId)
    .in("team_level", ["varsity", "jv", "freshman"])

  if (!teams?.length) return []

  const subTeams = teams.filter((t) => {
    const l = (t.team_level ?? "").toLowerCase()
    return l === "jv" || l === "freshman"
  })

  if (subTeams.length === 0) return []

  const candidatePlayerIds: { id: string; teamId: string; level: string }[] = []
  for (const t of subTeams) {
    const level = (t.team_level ?? "").toLowerCase() as "jv" | "freshman"
    const { data: players } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", t.id)
      .in("position_group", positionGroups)
    if (players?.length) {
      for (const p of players) {
        candidatePlayerIds.push({ id: p.id, teamId: t.id, level })
      }
    }
  }

  if (candidatePlayerIds.length === 0) return []

  const playerIds = [...new Set(candidatePlayerIds.map((c) => c.id))]
  const idToMeta = new Map(candidatePlayerIds.map((c) => [c.id, { teamId: c.teamId, level: c.level as "jv" | "freshman" }]))

  const { data: playerRows } = await supabase
    .from("players")
    .select("id, first_name, last_name, position_group")
    .in("id", playerIds)

  const { data: evaluations } = await supabase
    .from("player_evaluations")
    .select("player_id, practice_grade, playbook_mastery, created_at")
    .eq("program_id", programId)
    .in("player_id", playerIds)
    .order("created_at", { ascending: false })

  const latestEvalByPlayer = new Map<string | null, { practice_grade: string | null; playbook_mastery: string | null }>()
  for (const e of evaluations ?? []) {
    if (e.player_id && !latestEvalByPlayer.has(e.player_id)) {
      latestEvalByPlayer.set(e.player_id, {
        practice_grade: e.practice_grade ?? null,
        playbook_mastery: e.playbook_mastery ?? null,
      })
    }
  }

  const { data: knowledge } = await supabase
    .from("player_play_knowledge")
    .select("player_id, status")
    .eq("program_id", programId)
    .in("player_id", playerIds)

  const completedByPlayer = new Map<string, number>()
  for (const k of knowledge ?? []) {
    if (k.player_id) {
      const n = (completedByPlayer.get(k.player_id) ?? 0) + (k.status === "quiz_passed" || k.status === "completed" ? 1 : 0)
      completedByPlayer.set(k.player_id, n)
    }
  }

  const scored = (playerRows ?? [])
    .filter((p) => idToMeta.has(p.id))
    .map((p) => {
      const meta = idToMeta.get(p.id)!
      const ev = latestEvalByPlayer.get(p.id)
      const practiceGrade = ev?.practice_grade ?? null
      const playbookMastery = ev?.playbook_mastery ?? null
      const completed = completedByPlayer.get(p.id) ?? 0
      let score = gradeScore(practiceGrade) * 0.4 + gradeScore(playbookMastery) * 0.4 + Math.min(completed * 2, 20)
      if (meta.level === "jv") score += 5
      return {
        playerId: p.id,
        playerName: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unknown",
        currentLevel: meta.level,
        practiceGrade,
        playbookMastery,
        recentStatsSummary: completed > 0 ? `${completed} plays mastered` : null,
        score,
      }
    })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, limit)

  return top.map((t) => ({
    playerId: t.playerId,
    playerName: t.playerName,
    currentLevel: t.currentLevel,
    practiceGrade: t.practiceGrade,
    playbookMastery: t.playbookMastery,
    recentStatsSummary: t.recentStatsSummary,
    reason: [
      t.practiceGrade ? `Practice: ${t.practiceGrade}` : null,
      t.playbookMastery ? `Playbook: ${t.playbookMastery}` : null,
      t.recentStatsSummary ?? null,
    ]
      .filter(Boolean)
      .join(" · ") || "Ready for consideration",
  }))
}
