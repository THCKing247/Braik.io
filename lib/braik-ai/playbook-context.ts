import type { ContextModuleInput, PlayContext } from "./types"

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

    let plays: PlayContext[] = playRows.map((p) => ({
      id: p.id,
      name: p.name ?? "",
      formation: p.formation ?? "",
      subformation: p.sub_formation_id ? subMap.get(p.sub_formation_id) ?? p.subcategory : p.subcategory,
      tags: Array.isArray(p.tags) ? p.tags : null,
      concept: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags[0] : null,
      playType: p.play_type ?? null,
      notes: null,
      situation: null,
      motion: null,
      assignmentsSummary: null,
    }))

    if (entities.formationNames.length > 0 || entities.concepts.length > 0) {
      const lowerFormations = entities.formationNames.map((f) => f.toLowerCase())
      const lowerConcepts = entities.concepts.map((c) => c.toLowerCase())
      plays = plays.filter((play) => {
        const formMatch = lowerFormations.some((f) => play.formation.toLowerCase().includes(f) || (play.subformation ?? "").toLowerCase().includes(f))
        const conceptMatch = lowerConcepts.length === 0 || lowerConcepts.some((c) => (play.tags ?? []).some((t) => t.toLowerCase().includes(c)) || (play.concept ?? "").toLowerCase().includes(c))
        return formMatch || conceptMatch
      })
      if (plays.length === 0) plays = playRows.map((p) => ({
        id: p.id,
        name: p.name ?? "",
        formation: p.formation ?? "",
        subformation: p.sub_formation_id ? subMap.get(p.sub_formation_id) ?? p.subcategory : p.subcategory,
        tags: Array.isArray(p.tags) ? p.tags : null,
        concept: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags[0] : null,
        playType: p.play_type ?? null,
        notes: null,
        situation: null,
        motion: null,
        assignmentsSummary: null,
      })).slice(0, 40)
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
