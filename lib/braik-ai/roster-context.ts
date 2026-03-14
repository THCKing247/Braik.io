import type { ContextModuleInput, RosterContext } from "./types"

export async function getRosterContext(input: ContextModuleInput): Promise<RosterContext | null> {
  const { teamId, supabase } = input
  try {
    const { data: playerRows, error } = await supabase
      .from("players")
      .select("id, position_group")
      .eq("team_id", teamId)
    if (error) {
      console.error("[braik-ai] roster fetch failed", { teamId, message: error.message })
      return null
    }
    const players = (playerRows ?? []) as Array<{ id: string; position_group: string | null }>
    const countsByPosition: Record<string, number> = {}
    for (const p of players) {
      const pos = p.position_group?.trim() || "Other"
      countsByPosition[pos] = (countsByPosition[pos] ?? 0) + 1
    }

    const { data: depthRows } = await supabase
      .from("depth_chart_entries")
      .select("unit, position, string, player_id")
      .eq("team_id", teamId)
      .order("unit")
      .order("position")
      .order("string")
    const entries = (depthRows ?? []) as Array<{ unit: string; position: string; string: number; player_id: string | null }>
    const startersByPosition: Record<string, string[]> = {}
    for (const e of entries.filter((x) => x.string === 1 && x.player_id)) {
      const key = `${e.unit} ${e.position}`
      if (!startersByPosition[key]) startersByPosition[key] = []
      startersByPosition[key].push(e.player_id!)
    }
    const depthChartSummary = entries.slice(0, 50).map((e) => `${e.unit} ${e.position} string ${e.string}`)

    return {
      totalPlayers: players.length,
      countsByPosition,
      startersByPosition,
      depthChartSummary,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[braik-ai] getRosterContext failed", { teamId, message: msg })
    return null
  }
}
