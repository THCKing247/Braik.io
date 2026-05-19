import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

const defaultSubTemplate = { fieldView: "HALF", shapes: [], paths: [] }

/**
 * Batched playbook workspace payload for first paint (playbook + formations + plays + sub-formations).
 */
export async function loadPlaybookWorkspace(
  playbookId: string,
  teamId: string,
  supabase: SupabaseClient = getSupabaseServer()
) {
  const { data: playbook, error: pbError } = await supabase
    .from("playbooks")
    .select("id, team_id, name, visibility, created_at, updated_at")
    .eq("id", playbookId)
    .maybeSingle()

  if (pbError) throw new Error("Failed to load playbook")
  if (!playbook) return null
  if (playbook.team_id !== teamId) return null

  const [formationsResult, playsResult, subFormationsResult] = await Promise.all([
    supabase
      .from("formations")
      .select(
        "id, team_id, playbook_id, side, name, parent_formation_id, template_data, created_at, updated_at"
      )
      .eq("team_id", teamId)
      .eq("playbook_id", playbookId)
      .order("name", { ascending: true }),
    supabase
      .from("plays")
      .select(
        "id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, order_index, tags, created_at, updated_at"
      )
      .eq("team_id", teamId)
      .eq("playbook_id", playbookId)
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("sub_formations")
      .select("id, team_id, formation_id, side, name, template_data, created_at, updated_at")
      .eq("team_id", teamId)
      .order("name", { ascending: true }),
  ])

  if (formationsResult.error) throw new Error("Failed to load formations")
  if (playsResult.error) throw new Error("Failed to load plays")
  if (subFormationsResult.error) throw new Error("Failed to load sub-formations")

  const subFormations = (subFormationsResult.data ?? []).map((s) => ({
    id: s.id,
    teamId: s.team_id,
    formationId: s.formation_id,
    side: s.side,
    name: s.name,
    templateData: s.template_data ?? defaultSubTemplate,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }))

  const subNameById = new Map(subFormations.map((s) => [s.id, s.name]))

  const formations = (formationsResult.data ?? []).map((f) => ({
    id: f.id,
    teamId: f.team_id,
    playbookId: f.playbook_id ?? null,
    side: f.side,
    name: f.name,
    parentFormationId: f.parent_formation_id ?? null,
    templateData: f.template_data,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }))

  const plays = (playsResult.data ?? []).map((p) => {
    const sfId = p.sub_formation_id ?? null
    const canvasData = p.canvas_data
    const safeCanvas =
      canvasData != null && typeof canvasData === "object" && !Array.isArray(canvasData)
        ? canvasData
        : null
    return {
      id: p.id,
      teamId: p.team_id,
      playbookId: p.playbook_id ?? null,
      formationId: p.formation_id ?? null,
      subFormationId: sfId,
      side: p.side,
      formation: p.formation,
      subFormation: sfId ? subNameById.get(sfId) ?? null : null,
      subcategory: p.subcategory ?? null,
      name: p.name,
      canvasData: safeCanvas,
      orderIndex: p.order_index ?? null,
      tags: Array.isArray(p.tags) ? p.tags : null,
      createdAt: p.created_at ?? null,
      updatedAt: p.updated_at ?? null,
    }
  })

  return {
    playbook: {
      id: playbook.id,
      teamId: playbook.team_id,
      name: playbook.name,
      visibility: playbook.visibility ?? "team",
      createdAt: playbook.created_at,
      updatedAt: playbook.updated_at,
    },
    formations,
    plays,
    subFormations,
  }
}
