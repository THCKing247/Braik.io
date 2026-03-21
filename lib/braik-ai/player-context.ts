import type { ContextModuleInput, PlayerContext, PlayerGameStatEntry } from "./types"
import type { InjuryRowRelation } from "./shared"
import { parseInjuryPlayerName } from "./shared"

const RECENT_GAMES_CAP = 5
const TREND_GAMES = 3

/** Normalize one game_stats array element to PlayerGameStatEntry. */
function toGameStatEntry(raw: unknown): PlayerGameStatEntry | null {
  if (raw == null || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const stats = (o.stats != null && typeof o.stats === "object" && !Array.isArray(o.stats)) ? { ...(o.stats as Record<string, unknown>) } : { ...o }
  delete stats.gameId
  delete stats.date
  delete stats.opponent
  return { gameId: typeof o.gameId === "string" ? o.gameId : undefined, opponent: typeof o.opponent === "string" ? o.opponent : undefined, date: typeof o.date === "string" ? o.date : undefined, stats }
}

/** Build recentGames from players.game_stats array (last N). */
function recentGamesFromArray(gameStats: unknown): PlayerGameStatEntry[] {
  if (!Array.isArray(gameStats)) return []
  const entries: PlayerGameStatEntry[] = []
  for (let i = gameStats.length - 1; i >= 0 && entries.length < RECENT_GAMES_CAP; i--) {
    const e = toGameStatEntry(gameStats[i])
    if (e) entries.push(e)
  }
  return entries.reverse()
}

function num(s: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = s[k]
    if (v !== undefined && v !== null && v !== "") {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  const nested = (s.passing ?? s.rushing ?? s.receiving) as Record<string, unknown> | undefined
  if (nested && typeof nested === "object") {
    for (const k of keys) {
      const v = nested[k]
      if (v !== undefined && v !== null && typeof v === "number" && Number.isFinite(v)) return v
      if (v !== undefined && v !== null && v !== "") {
        const n = Number(v)
        if (Number.isFinite(n)) return n
      }
    }
  }
  return 0
}

/** Build short trend summary from recent games (e.g. "last 3: 245 yds, 2 TD") for primary category. */
function trendSummaryFromRecent(recent: PlayerGameStatEntry[], position: string | null): string | null {
  if (recent.length === 0) return null
  const take = recent.slice(-TREND_GAMES)
  let yards = 0
  let tds = 0
  let rec = 0
  const pos = (position ?? "").toUpperCase()
  for (const g of take) {
    const s = g.stats as Record<string, unknown>
    if (pos === "QB") {
      yards += num(s, "passing_yards", "yards")
      tds += num(s, "passing_tds", "tds")
    } else if (["RB", "WR", "TE"].includes(pos)) {
      yards += num(s, "rushing_yards", "receiving_yards", "yards")
      tds += num(s, "rushing_tds", "receiving_tds", "tds")
      rec += num(s, "receptions", "rec")
    } else {
      yards += num(s, "passing_yards", "rushing_yards", "receiving_yards", "yards")
      tds += num(s, "passing_tds", "rushing_tds", "receiving_tds", "tds")
      rec += num(s, "receptions", "rec")
    }
  }
  const parts: string[] = []
  if (yards > 0) parts.push(`${yards} yds`)
  if (tds > 0) parts.push(`${tds} TD`)
  if (rec > 0) parts.push(`${rec} rec`)
  return parts.length ? `last ${take.length}: ${parts.join(", ")}` : null
}

function extractStat(seasonStats: unknown, key: string): Record<string, unknown> | null {
  if (seasonStats == null || typeof seasonStats !== "object" || Array.isArray(seasonStats)) return null
  const o = (seasonStats as Record<string, unknown>)[key]
  return o != null && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null
}

/** Build nested stats from flat season_stats when DB stores flat keys (e.g. from profile stats form). */
function buildStatsFromFlat(seasonStats: unknown): PlayerContext["stats"] {
  const raw = seasonStats != null && typeof seasonStats === "object" && !Array.isArray(seasonStats)
    ? (seasonStats as Record<string, unknown>)
    : {}
  const get = (k: string): unknown => raw[k]
  const passing = extractStat(seasonStats, "passing") ?? (() => {
    const y = get("passing_yards"); const t = get("passing_tds"); const i = get("int_thrown")
    if (y === undefined && t === undefined && i === undefined) return null
    const o: Record<string, unknown> = {}
    if (y !== undefined && y !== null && y !== "") o.yards = y
    if (t !== undefined && t !== null && t !== "") o.tds = t
    if (i !== undefined && i !== null && i !== "") o.int_thrown = i
    return Object.keys(o).length ? o : null
  })()
  const rushing = extractStat(seasonStats, "rushing") ?? (() => {
    const y = get("rushing_yards"); const t = get("rushing_tds")
    if (y === undefined && t === undefined) return null
    const o: Record<string, unknown> = {}
    if (y !== undefined && y !== null && y !== "") o.yards = y
    if (t !== undefined && t !== null && t !== "") o.tds = t
    return Object.keys(o).length ? o : null
  })()
  const receiving = extractStat(seasonStats, "receiving") ?? (() => {
    const r = get("receptions"); const y = get("receiving_yards"); const t = get("receiving_tds")
    if (r === undefined && y === undefined && t === undefined) return null
    const o: Record<string, unknown> = {}
    if (r !== undefined && r !== null && r !== "") o.receptions = r
    if (y !== undefined && y !== null && y !== "") o.yards = y
    if (t !== undefined && t !== null && t !== "") o.tds = t
    return Object.keys(o).length ? o : null
  })()
  const defense = extractStat(seasonStats, "defense") ?? (() => {
    const t = get("tackles"); const s = get("sacks"); const i = get("interceptions")
    if (t === undefined && s === undefined && i === undefined) return null
    const o: Record<string, unknown> = {}
    if (t !== undefined && t !== null && t !== "") o.tackles = t
    if (s !== undefined && s !== null && s !== "") o.sacks = s
    if (i !== undefined && i !== null && i !== "") o.interceptions = i
    return Object.keys(o).length ? o : null
  })()
  return {
    passing: passing ?? null,
    rushing: rushing ?? null,
    receiving: receiving ?? null,
    defense: defense ?? null,
    kicking: extractStat(seasonStats, "kicking") ?? null,
    specialTeams: extractStat(seasonStats, "specialTeams") ?? null,
  }
}

export async function getPlayerContext(input: ContextModuleInput): Promise<PlayerContext[] | null> {
  const { teamId, message, entities, supabase } = input
  try {
    const select = "id, first_name, last_name, preferred_name, jersey_number, position_group, secondary_position, graduation_year, height, weight, role_depth_notes, coach_notes, profile_notes, season_stats, game_stats"
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
      game_stats?: unknown
    }
    const roster = (rows ?? []) as unknown as Row[]

    let practiceMap = new Map<string, string>()
    try {
      const { data: ppRows } = await supabase
        .from("practice_participation")
        .select("player_id, participation_status, occurred_at")
        .eq("team_id", teamId)
        .order("occurred_at", { ascending: false })
        .limit(200)
      if (ppRows?.length) {
        const seen = new Set<string>()
        for (const r of ppRows as Array<{ player_id: string; participation_status: string }>) {
          if (!seen.has(r.player_id)) {
            seen.add(r.player_id)
            practiceMap.set(r.player_id, r.participation_status ?? "unknown")
          }
        }
      }
    } catch {
      practiceMap = new Map()
    }
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
      .select(
        "player_id, injury_reason, expected_return_date, injury_date, severity, exempt_from_practice, players(first_name, last_name)"
      )
      .eq("team_id", teamId)
      .eq("status", "active")
    const injuryRowsTyped = (injuryRows ?? []) as unknown as Array<
      InjuryRowRelation & {
        injury_date?: string | null
        severity?: string | null
        exempt_from_practice?: boolean | null
      }
    >
    const injuryMap = new Map<
      string,
      { reason: string; expectedReturn: string | null; severity: string | null; exempt: boolean; injuryDate: string | null }
    >()
    for (const i of injuryRowsTyped) {
      injuryMap.set(i.player_id, {
        reason: i.injury_reason,
        expectedReturn: i.expected_return_date,
        severity: i.severity ?? null,
        exempt: i.exempt_from_practice === true,
        injuryDate: i.injury_date ?? null,
      })
    }

    const result: PlayerContext[] = relevant.map((p) => {
      const depth = depthMap.get(p.id)
      const inj = injuryMap.get(p.id)
      const health = (p as { health_status?: string }).health_status ?? "active"
      const availability = health === "injured" ? "injured" : health === "unavailable" ? "unavailable" : "active"
      const profileSummary = [p.role_depth_notes, p.profile_notes].filter(Boolean).join(" ") || null
      const recentGames = recentGamesFromArray(p.game_stats)
      const trendSummary = trendSummaryFromRecent(recentGames, p.position_group)
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
        injuryStatus: inj
          ? [
              inj.reason,
              inj.severity ? `severity: ${inj.severity}` : null,
              inj.exempt ? "practice exempt" : null,
              inj.expectedReturn ? `return ~${String(inj.expectedReturn).slice(0, 10)}` : null,
            ]
              .filter(Boolean)
              .join("; ")
          : null,
        profileSummary,
        coachNotes: p.coach_notes,
        stats: buildStatsFromFlat(p.season_stats),
        recentGames: recentGames.length ? recentGames : undefined,
        trendSummary: trendSummary ?? undefined,
        practiceParticipation: practiceMap.get(p.id) ?? undefined,
      }
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[braik-ai] getPlayerContext failed", { teamId, message: msg })
    return null
  }
}
