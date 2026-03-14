import type { ContextModuleInput, PlayerContext } from "./types"
import type { InjuryRowRelation } from "./shared"
import { parseInjuryPlayerName } from "./shared"

function extractStat(seasonStats: unknown, key: string): Record<string, unknown> | null {
  if (seasonStats == null || typeof seasonStats !== "object" || Array.isArray(seasonStats)) return null
  const o = (seasonStats as Record<string, unknown>)[key]
  return o != null && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null
}

export async function getPlayerContext(input: ContextModuleInput): Promise<PlayerContext[] | null> {
  const { teamId, message, entities, supabase } = input
  try {
    const select = "id, first_name, last_name, preferred_name, jersey_number, position_group, secondary_position, graduation_year, height, weight, role_depth_notes, coach_notes, profile_notes, season_stats"
    const { data: rows, error } = await supabase
      .from("players")
      .select(select)
      .eq("team_id", teamId)
      .order("last_name")
    if (error) {
      console.error("[braik-ai] players fetch failed", { teamId, message: error.message })
      return null
    }
    type Row = {
      id: string
      first_name: string | null
      last_name: string | null
      preferred_name: string | null
      jersey_number: number | null
      position_group: string | null
      secondary_position: string | null
      graduation_year?: number | null
      height: string | null
      weight: number | null
      role_depth_notes: string | null
      coach_notes: string | null
      profile_notes: string | null
      season_stats: unknown
    }
    const roster = (rows ?? []) as unknown as Row[]
    let withHealth = roster
    try {
      const { data: healthRows } = await supabase.from("players").select("id, health_status").eq("team_id", teamId)
      if (healthRows?.length) {
        const healthMap = new Map((healthRows as Array<{ id: string; health_status?: string }>).map((r) => [r.id, r.health_status ?? "active"]))
        withHealth = roster.map((p) => ({ ...p, health_status: healthMap.get(p.id) ?? "active" }))
      }
    } catch {
      withHealth = roster.map((p) => ({ ...p, health_status: "active" as string }))
    }

    let relevant = withHealth
    if (entities.namedPlayers.length > 0) {
      const lower = message.toLowerCase()
      relevant = withHealth.filter((p) => {
        const full = [p.preferred_name || p.first_name, p.last_name].filter(Boolean).join(" ").toLowerCase()
        const first = (p.first_name ?? "").toLowerCase()
        const last = (p.last_name ?? "").toLowerCase()
        return entities.namedPlayers.some((n) => lower.includes(n.toLowerCase()) && (full.includes(n.toLowerCase()) || first === n.toLowerCase() || last === n.toLowerCase()))
      })
      if (relevant.length === 0) relevant = withHealth
    } else if (entities.positions.length > 0) {
      relevant = withHealth.filter((p) => {
        const pos = (p.position_group ?? "").toUpperCase()
        const sec = (p.secondary_position ?? "").toUpperCase()
        return entities.positions.some((r) => pos.includes(r) || sec.includes(r))
      })
      if (relevant.length === 0) relevant = withHealth
    } else {
      relevant = withHealth.slice(0, 35)
    }

    const { data: depthRows } = await supabase
      .from("depth_chart_entries")
      .select("unit, position, string, player_id")
      .eq("team_id", teamId)
    const depthMap = new Map<string, { unit: string; position: string; string: number }>()
    for (const e of (depthRows ?? []) as Array<{ unit: string; position: string; string: number; player_id: string | null }>) {
      if (e.player_id) depthMap.set(e.player_id, { unit: e.unit, position: e.position, string: e.string })
    }

    const { data: injuryRows } = await supabase
      .from("player_injuries")
      .select("player_id, injury_reason, expected_return_date, players(first_name, last_name)")
      .eq("team_id", teamId)
      .eq("status", "active")
    const injuryRowsTyped = (injuryRows ?? []) as unknown as InjuryRowRelation[]
    const injuryMap = new Map<string, { reason: string; expectedReturn: string | null }>()
    for (const i of injuryRowsTyped) {
      injuryMap.set(i.player_id, { reason: i.injury_reason, expectedReturn: i.expected_return_date })
    }

    const result: PlayerContext[] = relevant.map((p) => {
      const depth = depthMap.get(p.id)
      const inj = injuryMap.get(p.id)
      const health = (p as { health_status?: string }).health_status ?? "active"
      const availability = health === "injured" ? "injured" : health === "unavailable" ? "unavailable" : "active"
      const seasonStats = p.season_stats
      const profileSummary = [p.role_depth_notes, p.profile_notes].filter(Boolean).join(" ") || null
      return {
        id: p.id,
        fullName: [p.preferred_name || p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unknown",
        jerseyNumber: p.jersey_number,
        primaryPosition: p.position_group,
        secondaryPositions: p.secondary_position,
        classYear: p.graduation_year ?? null,
        height: p.height,
        weight: p.weight,
        starter: depth != null && depth.string === 1,
        depthChartOrder: depth ? `${depth.unit} ${depth.position} string ${depth.string}` : null,
        availability,
        injuryStatus: inj ? `${inj.reason}${inj.expectedReturn ? ` (return ~${String(inj.expectedReturn).slice(0, 10)})` : ""}` : null,
        profileSummary,
        coachNotes: p.coach_notes,
        stats: {
          passing: extractStat(seasonStats, "passing"),
          rushing: extractStat(seasonStats, "rushing"),
          receiving: extractStat(seasonStats, "receiving"),
          defense: extractStat(seasonStats, "defense"),
          kicking: extractStat(seasonStats, "kicking"),
          specialTeams: extractStat(seasonStats, "specialTeams"),
        },
      }
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[braik-ai] getPlayerContext failed", { teamId, message: msg })
    return null
  }
}
