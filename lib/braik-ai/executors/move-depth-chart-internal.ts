import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type DepthChartUpdateInput = {
  unit: string
  position: string
  string: number
  playerId: string | null
  formation?: string | null
  specialTeamType?: string | null
}

/**
 * Applies depth chart slot updates for a team (single transactional intent).
 * Shared by direct tool execution and confirmed proposals.
 */
export async function applyDepthChartUpdates(params: {
  teamId: string
  updates: DepthChartUpdateInput[]
}): Promise<{ ok: true; rows: number } | { ok: false; message: string }> {
  const { teamId, updates: raw } = params
  type Row = {
    team_id: string
    unit: string
    position: string
    string: number
    player_id: string | null
    formation: string | null
    special_team_type: string | null
  }
  const entriesToInsert: Row[] = []
  const seen = new Set<string>()
  for (const u of raw) {
    const stringNum = typeof u.string === "number" ? u.string : parseInt(String(u.string), 10)
    if (Number.isNaN(stringNum) || stringNum < 1) continue
    const unit = String(u.unit ?? "").trim()
    const position = String(u.position ?? "").trim()
    const key = `${unit}:${position}:${stringNum}`
    if (!unit || !position || seen.has(key)) continue
    seen.add(key)
    entriesToInsert.push({
      team_id: teamId,
      unit,
      position,
      string: stringNum,
      player_id: u.playerId && String(u.playerId).trim() ? String(u.playerId) : null,
      formation: u.formation != null && String(u.formation).trim() !== "" ? String(u.formation).trim() : null,
      special_team_type:
        u.specialTeamType != null && String(u.specialTeamType).trim() !== ""
          ? String(u.specialTeamType).trim()
          : null,
    })
  }
  if (entriesToInsert.length === 0) {
    return { ok: false, message: "No valid depth chart rows." }
  }

  const supabase = getSupabaseServer()
  for (const row of entriesToInsert) {
    const { error: deleteError } = await supabase
      .from("depth_chart_entries")
      .delete()
      .eq("team_id", teamId)
      .eq("unit", row.unit)
      .eq("position", row.position)
    if (deleteError) {
      console.error("[Coach B depth chart] delete", deleteError)
    }
  }
  const { error: insertError } = await supabase.from("depth_chart_entries").insert(entriesToInsert)
  if (insertError) {
    console.error("[Coach B depth chart] insert", insertError)
    return { ok: false, message: "Failed to update depth chart." }
  }

  console.log("[Coach B depth chart] applied", { teamId, rows: entriesToInsert.length })
  return { ok: true, rows: entriesToInsert.length }
}
