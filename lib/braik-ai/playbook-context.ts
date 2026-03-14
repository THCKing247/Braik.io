import type { ContextModuleInput, PlayContext, PlayCallResultEntry } from "./types"

/** Derive situation from play tags for recommendPlaysForSituation (plays.tags are e.g. "Red Zone", "3rd Down"). */
function situationFromTags(tags: string[] | null): string | null {
  if (!tags?.length) return null
  const lower = tags.map((t) => t.toLowerCase())
  if (lower.some((t) => t.includes("red zone") || t.includes("redzone"))) return "red zone"
  if (lower.some((t) => t.includes("goal line") || t.includes("goalline"))) return "goal line"
  if (lower.some((t) => t.includes("3rd down") || t.includes("3rd and long"))) return "3rd and long"
  if (lower.some((t) => t.includes("3rd and medium"))) return "3rd and medium"
  if (lower.some((t) => t.includes("3rd and short"))) return "3rd and short"
  if (lower.some((t) => t.includes("3rd"))) return "3rd down"
  if (lower.some((t) => t.includes("short") || t.includes("medium") || t.includes("long"))) return lower.find((t) => t.includes("short") || t.includes("medium") || t.includes("long")) ?? null
  return null
}

export async function getPlaybookContext(input: ContextModuleInput): Promise<{
  playbooks: Array<{ id: string; name: string; formationCount?: number; playCount?: number }>
  formations: Array<{ id: string; name: string; side: string; playbookId: string | null; subFormationCount?: number; playCount?: number }>
  plays: PlayContext[]
} | null> {
  const { teamId, entities, supabase } = input
  try {
    const { data: pbRows, error: pbErr } = await supabase
      .from("playbooks")
      .select("id, name")
      .eq("team_id", teamId)
      .order("name")
    if (pbErr) {
      console.error("[braik-ai] playbooks fetch failed", { teamId, message: pbErr.message })
      return null
    }
    const playbooks = (pbRows ?? []).map((p) => ({ id: p.id, name: p.name ?? "" }))

    const { data: formRows, error: formErr } = await supabase
      .from("formations")
      .select("id, name, side, playbook_id")
      .eq("team_id", teamId)
      .order("name")
    if (formErr) return { playbooks, formations: [], plays: [] }
    const formations = (formRows ?? []).map((f) => ({
      id: f.id,
      name: f.name ?? "",
      side: f.side ?? "offense",
      playbookId: f.playbook_id ?? null,
    }))

    const playsSelect = "id, name, formation_id, sub_formation_id, formation, subcategory, play_type, tags"
    let playRows: Array<{ id: string; name: string; formation: string; subcategory: string | null; sub_formation_id?: string; play_type?: string; tags?: string[] }> = []
    const res = await supabase.from("plays").select(playsSelect).eq("team_id", teamId).order("name")
    if (res.error) {
      const fallback = await supabase.from("plays").select("id, name, formation, subcategory").eq("team_id", teamId).order("name")
      playRows = (fallback.data ?? []) as typeof playRows
    } else {
      playRows = (res.data ?? []) as typeof playRows
    }
    const subIds = [...new Set(playRows.map((p) => p.sub_formation_id).filter(Boolean))] as string[]
    let subMap = new Map<string, string>()
    if (subIds.length > 0) {
      const { data: subRows } = await supabase.from("sub_formations").select("id, name").in("id", subIds)
      subMap = new Map((subRows ?? []).map((s) => [s.id, s.name ?? ""]))
    }

    type CallRow = { play_id: string; yards_gained: number | null; success: boolean | null; touchdown: boolean | null; game_id: string | null; created_at: string }
    let analyticsMap = new Map<string, { usageCount: number; successCount: number; totalYards: number; recent: PlayCallResultEntry[] }>()
    try {
      const { data: callRows } = await supabase
        .from("play_call_results")
        .select("play_id, yards_gained, success, touchdown, game_id, created_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(500)
      if (callRows?.length) {
        const rowsByPlay = new Map<string, CallRow[]>()
        for (const r of callRows as CallRow[]) {
          const list = rowsByPlay.get(r.play_id) ?? []
          list.push(r)
          rowsByPlay.set(r.play_id, list)
        }
        for (const [playId, rows] of rowsByPlay) {
          const usageCount = rows.length
          const successCount = rows.filter((x) => x.success === true).length
          const totalYards = rows.reduce((sum, x) => sum + (x.yards_gained != null && Number.isFinite(x.yards_gained) ? x.yards_gained : 0), 0)
          const recent: PlayCallResultEntry[] = rows.slice(0, 3).map((x) => ({ yardsGained: x.yards_gained ?? undefined, success: x.success ?? undefined, touchdown: x.touchdown ?? undefined, gameId: x.game_id ?? undefined, date: x.created_at?.slice(0, 10) }))
          analyticsMap.set(playId, { usageCount, successCount, totalYards, recent })
        }
      }
    } catch {
      analyticsMap = new Map()
    }

    let plays: PlayContext[] = playRows.map((p) => {
      const tagList = Array.isArray(p.tags) ? p.tags : null
      const situation = situationFromTags(tagList)
      const analytics = analyticsMap.get(p.id)
      return {
        id: p.id,
        name: p.name ?? "",
        formation: p.formation ?? "",
        subformation: p.sub_formation_id ? subMap.get(p.sub_formation_id) ?? p.subcategory : p.subcategory,
        tags: tagList,
        concept: tagList && tagList.length > 0 ? tagList[0] : null,
        playType: p.play_type ?? null,
        notes: null,
        situation,
        motion: null,
        assignmentsSummary: null,
        usageCount: analytics?.usageCount,
        successRate: analytics && analytics.usageCount > 0 ? analytics.successCount / analytics.usageCount : undefined,
        avgYards: analytics && analytics.usageCount > 0 && analytics.totalYards > 0 ? Math.round(analytics.totalYards / analytics.usageCount) : undefined,
        recentResults: analytics?.recent?.length ? analytics.recent : undefined,
      }
    })

    if (entities.formationNames.length > 0 || entities.concepts.length > 0) {
      const lowerFormations = entities.formationNames.map((f) => f.toLowerCase())
      const lowerConcepts = entities.concepts.map((c) => c.toLowerCase())
      plays = plays.filter((play) => {
        const formMatch = lowerFormations.some((f) => play.formation.toLowerCase().includes(f) || (play.subformation ?? "").toLowerCase().includes(f))
        const conceptMatch = lowerConcepts.length === 0 || lowerConcepts.some((c) => (play.tags ?? []).some((t) => t.toLowerCase().includes(c)) || (play.concept ?? "").toLowerCase().includes(c))
        return formMatch || conceptMatch
      })
      if (plays.length === 0) plays = playRows.map((p) => {
        const tagList = Array.isArray(p.tags) ? p.tags : null
        const analytics = analyticsMap.get(p.id)
        return {
          id: p.id,
          name: p.name ?? "",
          formation: p.formation ?? "",
          subformation: p.sub_formation_id ? subMap.get(p.sub_formation_id) ?? p.subcategory : p.subcategory,
          tags: tagList,
          concept: tagList && tagList.length > 0 ? tagList[0] : null,
          playType: p.play_type ?? null,
          notes: null,
          situation: situationFromTags(tagList),
          motion: null,
          assignmentsSummary: null,
          usageCount: analytics?.usageCount,
          successRate: analytics && analytics.usageCount > 0 ? analytics.successCount / analytics.usageCount : undefined,
          avgYards: analytics && analytics.usageCount > 0 && analytics.totalYards > 0 ? Math.round(analytics.totalYards / analytics.usageCount) : undefined,
          recentResults: analytics?.recent?.length ? analytics.recent : undefined,
        }
      }).slice(0, 40)
    } else {
      plays = plays.slice(0, 50)
    }

    return { playbooks, formations, plays }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[braik-ai] getPlaybookContext failed", { teamId, message: msg })
    return null
  }
}
