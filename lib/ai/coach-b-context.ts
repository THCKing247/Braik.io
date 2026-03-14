/**
 * Coach B context: fetch Braik team and player data from Supabase for AI prompts.
 * Used by app/api/ai/chat/route.ts. All player-related questions use Braik roster, profiles, depth chart, stats, injuries, schedule.
 */

import { getSupabaseServer } from "@/src/lib/supabaseServer"

// ─── Question type detection ─────────────────────────────────────────────────

export type QuestionType =
  | "player_decision"
  | "player_comparison"
  | "player_evaluation"
  | "player_availability"
  | "player_stats"
  | "depth_chart"
  | "schedule"
  | "play_strategy"
  | "generic"

/** Position abbreviations we recognize (Braik uses position_group on players). */
const POSITION_PATTERNS: Array<{ pattern: RegExp; position: string }> = [
  { pattern: /\bqb\b|quarterback/i, position: "QB" },
  { pattern: /\brb\b|running back|halfback|tailback/i, position: "RB" },
  { pattern: /\bwr\b|wide receiver/i, position: "WR" },
  { pattern: /\bte\b|tight end/i, position: "TE" },
  { pattern: /\bol\b|offensive line|lineman/i, position: "OL" },
  { pattern: /\bdl\b|defensive line|d-?line/i, position: "DL" },
  { pattern: /\blb\b|linebacker/i, position: "LB" },
  { pattern: /\bdb\b|defensive back|corner|safety|cb\b|s\b(?!\w)/i, position: "DB" },
  { pattern: /\bcb\b|cornerback/i, position: "CB" },
  { pattern: /\bk\b|kicker|placekicker/i, position: "K" },
  { pattern: /\bp\b|punter/i, position: "P" },
  { pattern: /\bst\b|special team/i, position: "ST" },
]

/**
 * Detect the topic of the user question for routing context fetch.
 */
export function detectQuestionType(message: string): QuestionType {
  const lower = message.toLowerCase().trim()

  // Player comparison (named or "these players", "compare")
  if (
    /\bcompare\b|who is better|who('s| is) better|versus\b|vs\.?\s|start over\s|over\s+\w+\s+\?/i.test(lower) ||
    /\b(mason|tyler|kenneth|start)\s+(\w+\s+)?over\s/i.test(lower)
  ) {
    return "player_comparison"
  }
  // Player evaluation / opinion
  if (
    /\bwhat do you think (about|of)\b|evaluate\b|rank\s+my\b|how is \w+ doing|how('s| is) \w+ doing/i.test(lower) ||
    /\bthoughts on\b|opinion on\b|assessment of\b/i.test(lower)
  ) {
    return "player_evaluation"
  }
  // Availability / injury
  if (
    /\bwho is (injured|hurt|out|available|healthy)\b|who('s| is) (injured|hurt|available)|is \w+ (healthy|available|injured|hurt)\b/i.test(lower) ||
    /\bavailability\b|injury (report|list)|healthy enough to play/i.test(lower)
  ) {
    return "player_availability"
  }
  // Stats / leads
  if (
    /\bwho leads?\b|leads? the team|most \w+ (yards|tds|tackles)|stats?\b|statistics\b|numbers\b/i.test(lower)
  ) {
    return "player_stats"
  }
  // Start / who should play / touches / special teams
  if (
    /\bwho should (i )?start\b|which \w+ should i start|who should i play\b|who should get (more )?(touches|carries|reps)\b/i.test(lower) ||
    /\bshould \w+ start\b|who should (return|be on) (kicks?|punts?|special teams)\b/i.test(lower) ||
    /\b(my )?best (wr|rb|qb|lb|db|te|receiver|linebacker|corner)\b/i.test(lower) ||
    /\bwhich (qb|wr|rb|corner|receiver) should\b/i.test(lower) ||
    /\brank my (receivers?|linebackers?|rbs?|dbs?)\b/i.test(lower) ||
    /\bwhich (corner|cb) should shadow\b/i.test(lower)
  ) {
    return "player_decision"
  }
  // Depth chart
  if (
    /\bdepth chart\b|depthchart\b|first string|second string|depth (at|for)\b/i.test(lower)
  ) {
    return "depth_chart"
  }
  // Schedule
  if (
    /\bschedule\b|next (game|week|opponent)|when (do we|are we) (play|have)\b|opponent\b|events?\b|calendar\b/i.test(lower)
  ) {
    return "schedule"
  }
  // Play / strategy
  if (
    /\bplay\b.*\b(suggest|call|call sheet)\b|\bformation\b|\bscout\b|\bcall\s+(a )?play\b/i.test(lower)
  ) {
    return "play_strategy"
  }

  return "generic"
}

/**
 * Detect position groups mentioned in the message (e.g. QB, WR, RB).
 */
export function detectRelevantPositions(message: string): string[] {
  const positions: string[] = []
  const lower = message.toLowerCase()
  for (const { pattern, position } of POSITION_PATTERNS) {
    if (pattern.test(lower) && !positions.includes(position)) {
      positions.push(position)
    }
  }
  return positions
}

// ─── Roster player type (from Supabase players table) ───────────────────────

export interface RosterPlayer {
  id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  jersey_number: number | null
  position_group: string | null
  secondary_position: string | null
  grade: number | null
  status: string | null
  health_status?: string | null
  notes: string | null
  height: string | null
  weight: number | null
  role_depth_notes: string | null
  coach_notes: string | null
  profile_notes: string | null
  season_stats: unknown
  game_stats: unknown
  practice_metrics: unknown
}

// ─── Named player detection ────────────────────────────────────────────────

/**
 * Match names in the message to roster players (first, last, or preferred name).
 */
export function detectNamedPlayers(message: string, roster: RosterPlayer[]): RosterPlayer[] {
  const normalized = message.trim().toLowerCase()
  if (!normalized || roster.length === 0) return []

  const words = normalized.split(/\s+/).filter((w) => w.length > 1)
  const matched = new Set<string>()

  for (const p of roster) {
    const first = (p.first_name ?? "").toLowerCase()
    const last = (p.last_name ?? "").toLowerCase()
    const preferred = (p.preferred_name ?? "").toLowerCase()
    const full = `${first} ${last}`.trim()
    const fullReverse = `${last} ${first}`.trim()

    if (first && normalized.includes(first)) matched.add(p.id)
    if (last && normalized.includes(last)) matched.add(p.id)
    if (preferred && normalized.includes(preferred)) matched.add(p.id)
    if (full && normalized.includes(full)) matched.add(p.id)
    if (fullReverse && normalized.includes(fullReverse)) matched.add(p.id)
    // Single-word name match (e.g. "Mason" or "Kenneth")
    if (first && words.some((w) => w === first)) matched.add(p.id)
    if (last && words.some((w) => w === last)) matched.add(p.id)
    if (preferred && words.some((w) => w === preferred)) matched.add(p.id)
  }

  return roster.filter((p) => matched.has(p.id))
}

// ─── Normalized player context shape ────────────────────────────────────────

export interface RelevantPlayerContext {
  id: string
  fullName: string
  jerseyNumber: number | null
  primaryPosition: string | null
  secondaryPositions: string | null
  classYear: number | null
  height: string | null
  weight: number | null
  starter: boolean
  depthChartOrder: string | null
  availability: string
  injuryStatus: string | null
  profileSummary: string | null
  coachNotes: string | null
  stats: {
    passing: Record<string, unknown>
    rushing: Record<string, unknown>
    receiving: Record<string, unknown>
    defense: Record<string, unknown>
    kicking: Record<string, unknown>
    specialTeams: Record<string, unknown>
  }
}

export interface BraikContext {
  team: { id: string; name: string | null }
  questionType: QuestionType
  relevantPositions: string[]
  namedPlayers: Array<{ id: string; fullName: string }>
  relevantPlayers: RelevantPlayerContext[]
  upcomingGame: { opponent: string | null; date: string } | null
  upcomingEvents: Array<{ title: string; start: string; type: string }>
  activeInjuriesSummary: string | null
}

// ─── Injury row type (Supabase relation can return object or array) ───────────

type InjuryRow = {
  player_id: string
  injury_reason: string
  expected_return_date: string | null
  players?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}

function parseInjuryPlayerName(i: InjuryRow): string {
  const p = i.players
  if (!p) return i.player_id
  if (Array.isArray(p)) return p[0] ? `${p[0].first_name} ${p[0].last_name}` : i.player_id
  return `${p.first_name} ${p.last_name}`
}

// ─── Merge one player's data into normalized shape ───────────────────────────

function extractStatsSection(seasonStats: unknown, key: string): Record<string, unknown> {
  if (seasonStats == null || typeof seasonStats !== "object" || Array.isArray(seasonStats)) return {}
  const o = (seasonStats as Record<string, unknown>)[key]
  return o != null && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {}
}

/**
 * Merge roster row, depth chart, injury, and profile into a single normalized player context.
 */
export function mergePlayerContext(
  roster: RosterPlayer,
  depthEntry: { unit: string; position: string; string: number } | null,
  injury: { reason: string; expectedReturn: string | null } | null,
  _profileExtra?: unknown
): RelevantPlayerContext {
  const fullName = [roster.preferred_name || roster.first_name, roster.last_name].filter(Boolean).join(" ").trim() || "Unknown"
  const seasonStats = roster.season_stats
  const stats = {
    passing: extractStatsSection(seasonStats, "passing"),
    rushing: extractStatsSection(seasonStats, "rushing"),
    receiving: extractStatsSection(seasonStats, "receiving"),
    defense: extractStatsSection(seasonStats, "defense"),
    kicking: extractStatsSection(seasonStats, "kicking"),
    specialTeams: extractStatsSection(seasonStats, "specialTeams"),
  }
  const availability = roster.health_status === "injured" ? "injured" : roster.health_status === "unavailable" ? "unavailable" : "active"
  const injuryStatus = injury ? `${injury.reason}${injury.expectedReturn ? ` (return ~${String(injury.expectedReturn).slice(0, 10)})` : ""}` : null
  const depthChartOrder = depthEntry ? `${depthEntry.unit} ${depthEntry.position} string ${depthEntry.string}` : null
  const profileSummary = [roster.role_depth_notes, roster.profile_notes].filter(Boolean).join(" ") || null

  return {
    id: roster.id,
    fullName,
    jerseyNumber: roster.jersey_number,
    primaryPosition: roster.position_group,
    secondaryPositions: roster.secondary_position,
    classYear: roster.grade,
    height: roster.height,
    weight: roster.weight,
    starter: depthEntry != null && depthEntry.string === 1,
    depthChartOrder,
    availability,
    injuryStatus,
    profileSummary,
    coachNotes: roster.coach_notes,
    stats,
  }
}

// ─── Build prompt block from normalized context ──────────────────────────────

/**
 * Format BraikContext into the text block included in the system prompt.
 */
export function buildBraikContext(context: BraikContext): string {
  const lines: string[] = []
  lines.push(`Team: ${context.team.name ?? "Unknown"} (ID: ${context.team.id})`)
  lines.push(`Question type: ${context.questionType}`)
  if (context.relevantPositions.length > 0) {
    lines.push(`Relevant positions: ${context.relevantPositions.join(", ")}`)
  }
  if (context.namedPlayers.length > 0) {
    lines.push(`Named players in question: ${context.namedPlayers.map((p) => p.fullName).join(", ")}`)
  }
  if (context.upcomingGame) {
    lines.push(`Upcoming game: ${context.upcomingGame.date.slice(0, 10)} vs ${context.upcomingGame.opponent ?? "TBD"}`)
  }
  if (context.activeInjuriesSummary) {
    lines.push(`\nActive injuries:\n${context.activeInjuriesSummary}`)
  }
  if (context.upcomingEvents.length > 0) {
    lines.push("\nUpcoming events (next 14 days):")
    context.upcomingEvents.slice(0, 8).forEach((e) => {
      lines.push(`  ${e.start.slice(0, 10)} ${e.type}: ${e.title}`)
    })
  }
  lines.push(`\nRelevant players (${context.relevantPlayers.length}):`)
  for (const p of context.relevantPlayers) {
    const parts = [
      `- ${p.fullName} #${p.jerseyNumber ?? "—"} ${p.primaryPosition ?? ""}`.trim(),
      p.secondaryPositions ? `sec: ${p.secondaryPositions}` : null,
      p.depthChartOrder ? `depth: ${p.depthChartOrder}` : null,
      p.starter ? "starter" : null,
      `availability: ${p.availability}`,
      p.injuryStatus ? `injury: ${p.injuryStatus}` : null,
      p.coachNotes ? `coach notes: ${p.coachNotes}` : null,
      p.profileSummary ? `profile: ${p.profileSummary}` : null,
    ].filter(Boolean)
    const statStr = [
      Object.keys(p.stats.passing).length ? "passing" : null,
      Object.keys(p.stats.rushing).length ? "rushing" : null,
      Object.keys(p.stats.receiving).length ? "receiving" : null,
      Object.keys(p.stats.defense).length ? "defense" : null,
    ].filter(Boolean)
    if (statStr.length) parts.push(`stats: ${statStr.join(", ")}`)
    lines.push(parts.join(" | "))
  }
  return "Braik Team Context:\n" + lines.join("\n")
}

// ─── Fetch player context (main entry for player-related questions) ──────────

/**
 * Fetch roster, depth chart, injuries, schedule; detect positions and named players;
 * filter to relevant players and merge into normalized shape.
 */
export async function getPlayerContext(teamId: string, message: string): Promise<BraikContext | null> {
  try {
    const supabase = getSupabaseServer()
    const questionType = detectQuestionType(message)
    const relevantPositions = detectRelevantPositions(message)

    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("id, name")
      .eq("id", teamId)
      .maybeSingle()
    if (teamErr || !team) {
      console.error("[Coach B context] team fetch failed", { teamId, error: teamErr?.message })
      return null
    }

    const playerSelect = [
      "id", "first_name", "last_name", "preferred_name", "jersey_number", "position_group", "secondary_position",
      "grade", "status", "notes", "height", "weight", "role_depth_notes", "coach_notes", "profile_notes",
      "season_stats", "game_stats", "practice_metrics",
    ].join(", ")
    const { data: playerRows, error: playersErr } = await supabase
      .from("players")
      .select(playerSelect)
      .eq("team_id", teamId)
      .order("last_name", { ascending: true })

    if (playersErr) {
      console.error("[Coach B context] players fetch failed", { teamId, error: playersErr.message })
      return null
    }

    let roster = (playerRows ?? []) as unknown as RosterPlayer[]
    try {
      const { data: healthRows } = await supabase.from("players").select("id, health_status").eq("team_id", teamId)
      if (healthRows) {
        const healthMap = new Map((healthRows as Array<{ id: string; health_status?: string }>).map((r) => [r.id, r.health_status ?? "active"]))
        roster = roster.map((p) => ({ ...p, health_status: healthMap.get(p.id) ?? (p as { health_status?: string }).health_status ?? "active" }))
      }
    } catch {
      roster = roster.map((p) => ({ ...p, health_status: (p as { health_status?: string }).health_status ?? "active" }))
    }

    const namedPlayers = detectNamedPlayers(message, roster)
    const isPlayerRelated =
      questionType === "player_decision" || questionType === "player_comparison" ||
      questionType === "player_evaluation" || questionType === "player_availability" ||
      questionType === "player_stats" || questionType === "depth_chart"

    let relevantPlayers: RosterPlayer[]
    if (namedPlayers.length > 0) {
      relevantPlayers = namedPlayers
    } else if (relevantPositions.length > 0 && isPlayerRelated) {
      relevantPlayers = roster.filter((p) => {
        const pos = (p.position_group ?? "").toUpperCase()
        const sec = (p.secondary_position ?? "").toUpperCase()
        return relevantPositions.some((r) => pos.includes(r) || sec.includes(r))
      })
    } else if (isPlayerRelated) {
      relevantPlayers = roster
    } else {
      relevantPlayers = roster.slice(0, 25)
    }

    const { data: depthRows } = await supabase
      .from("depth_chart_entries")
      .select("unit, position, string, player_id")
      .eq("team_id", teamId)
      .order("unit")
      .order("position")
      .order("string")
    const depthByPlayerId = new Map<string, { unit: string; position: string; string: number }>()
    for (const e of (depthRows ?? []) as Array<{ unit: string; position: string; string: number; player_id: string | null }>) {
      if (e.player_id) depthByPlayerId.set(e.player_id, { unit: e.unit, position: e.position, string: e.string })
    }

    const { data: injuryRows } = await supabase
      .from("player_injuries")
      .select("player_id, injury_reason, expected_return_date, players(first_name, last_name)")
      .eq("team_id", teamId)
      .eq("status", "active")
    const injuriesRaw = (injuryRows ?? []) as unknown as InjuryRow[]
    const injuryByPlayerId = new Map<string, { reason: string; expectedReturn: string | null }>()
    for (const i of injuriesRaw) {
      injuryByPlayerId.set(i.player_id, { reason: i.injury_reason, expectedReturn: i.expected_return_date })
    }

    const now = new Date().toISOString()
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    let upcomingGame: { opponent: string | null; date: string } | null = null
    try {
      const { data: gameRows } = await supabase
        .from("games")
        .select("opponent, game_date")
        .eq("team_id", teamId)
        .gte("game_date", now)
        .lte("game_date", twoWeeks)
        .order("game_date", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (gameRows) {
        const g = gameRows as { opponent: string | null; game_date: string }
        upcomingGame = { opponent: g.opponent, date: g.game_date }
      }
    } catch {
      //
    }

    const { data: eventRows } = await supabase
      .from("events")
      .select("title, start, event_type")
      .eq("team_id", teamId)
      .gte("start", now)
      .lte("start", twoWeeks)
      .order("start")
      .limit(10)
    const upcomingEvents = ((eventRows ?? []) as Array<{ title: string; start: string; event_type: string }>).map((e) => ({
      title: e.title,
      start: e.start,
      type: e.event_type ?? "event",
    }))

    const activeInjuriesSummary =
      injuriesRaw.length > 0
        ? injuriesRaw.map((i) => `  - ${parseInjuryPlayerName(i)}: ${i.injury_reason}${i.expected_return_date ? ` (return ~${String(i.expected_return_date).slice(0, 10)})` : ""}`).join("\n")
        : null

    const merged = relevantPlayers.map((r) =>
      mergePlayerContext(
        r,
        depthByPlayerId.get(r.id) ?? null,
        injuryByPlayerId.has(r.id) ? injuryByPlayerId.get(r.id)! : null
      )
    )

    return {
      team: { id: teamId, name: team.name ?? null },
      questionType,
      relevantPositions,
      namedPlayers: namedPlayers.map((p) => ({
        id: p.id,
        fullName: [p.preferred_name || p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unknown",
      })),
      relevantPlayers: merged,
      upcomingGame,
      upcomingEvents,
      activeInjuriesSummary,
    }
  } catch (err) {
    console.error("[Coach B context] getPlayerContext failed", { teamId, error: err })
    return null
  }
}

// ─── Team context summary (for getTeamContext return and route logging) ─────

export interface TeamContextSummary {
  teamName: string | null
  playerCount: number
  depthChartEntryCount: number
  upcomingEventCount: number
  upcomingGameCount: number
  activeInjuryCount: number
  relevantPlayerCount: number
  namedPlayersMatched: number
  relevantPositionsMatched: number
  braikContextBlock: string
}

/**
 * Fetch team context: for player-related questions use full player context; otherwise schedule/generic summary.
 */
export async function getTeamContext(teamId: string, message: string): Promise<TeamContextSummary | null> {
  const questionType = detectQuestionType(message)
  const isPlayerRelated =
    questionType === "player_decision" || questionType === "player_comparison" ||
    questionType === "player_evaluation" || questionType === "player_availability" ||
    questionType === "player_stats" || questionType === "depth_chart"

  if (isPlayerRelated) {
    const playerContext = await getPlayerContext(teamId, message)
    if (!playerContext) return null
    const braikContextBlock = buildBraikContext(playerContext)
    const rosterCount = await getRosterCount(teamId)
    const injuryCount = playerContext.activeInjuriesSummary ? playerContext.activeInjuriesSummary.split("\n").length : 0
    return {
      teamName: playerContext.team.name,
      playerCount: rosterCount,
      depthChartEntryCount: 0,
      upcomingEventCount: playerContext.upcomingEvents.length,
      upcomingGameCount: playerContext.upcomingGame ? 1 : 0,
      activeInjuryCount: injuryCount,
      relevantPlayerCount: playerContext.relevantPlayers.length,
      namedPlayersMatched: playerContext.namedPlayers.length,
      relevantPositionsMatched: playerContext.relevantPositions.length,
      braikContextBlock,
    }
  }

  if (questionType === "schedule") {
    const ctx = await getScheduleOnlyContext(teamId)
    if (!ctx) return null
    return {
      teamName: ctx.teamName,
      playerCount: 0,
      depthChartEntryCount: 0,
      upcomingEventCount: ctx.events.length,
      upcomingGameCount: ctx.games.length,
      activeInjuryCount: 0,
      relevantPlayerCount: 0,
      namedPlayersMatched: 0,
      relevantPositionsMatched: 0,
      braikContextBlock: ctx.braikContextBlock,
    }
  }

  const ctx = await getGenericTeamSummary(teamId)
  if (!ctx) return null
  return {
    teamName: ctx.teamName,
    playerCount: ctx.playerCount,
    depthChartEntryCount: ctx.depthChartEntryCount,
    upcomingEventCount: ctx.upcomingEventCount,
    upcomingGameCount: ctx.upcomingGameCount,
    activeInjuryCount: ctx.activeInjuryCount,
    relevantPlayerCount: 0,
    namedPlayersMatched: 0,
    relevantPositionsMatched: 0,
    braikContextBlock: ctx.braikContextBlock,
  }
}

async function getRosterCount(teamId: string): Promise<number> {
  try {
    const supabase = getSupabaseServer()
    const { count } = await supabase.from("players").select("id", { count: "exact", head: true }).eq("team_id", teamId)
    return count ?? 0
  } catch {
    return 0
  }
}

async function getScheduleOnlyContext(teamId: string): Promise<{
  teamName: string | null
  events: Array<{ title: string; start: string; type: string }>
  games: Array<{ opponent: string | null; date: string; gameType: string | null }>
  braikContextBlock: string
} | null> {
  try {
    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
    const now = new Date().toISOString()
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: eventRows } = await supabase
      .from("events")
      .select("title, start, event_type")
      .eq("team_id", teamId)
      .gte("start", now)
      .lte("start", twoWeeks)
      .order("start")
      .limit(15)
    const events = ((eventRows ?? []) as Array<{ title: string; start: string; event_type: string }>).map((e) => ({
      title: e.title,
      start: e.start,
      type: e.event_type ?? "event",
    }))
    let games: Array<{ opponent: string | null; date: string; gameType: string | null }> = []
    try {
      const { data: gameRows } = await supabase
        .from("games")
        .select("opponent, game_date, game_type")
        .eq("team_id", teamId)
        .gte("game_date", now)
        .lte("game_date", twoWeeks)
        .order("game_date")
        .limit(10)
      games = ((gameRows ?? []) as Array<{ opponent: string | null; game_date: string; game_type: string | null }>).map(
        (g) => ({ opponent: g.opponent, date: g.game_date, gameType: g.game_type })
      )
    } catch {
      //
    }
    const lines = [`Team: ${(team as { name?: string } | null)?.name ?? "Unknown"} (ID: ${teamId})`, "\nUpcoming events:", ...events.map((e) => `  ${e.start.slice(0, 10)} ${e.type}: ${e.title}`)]
    if (games.length) lines.push("\nUpcoming games:", ...games.map((g) => `  ${g.date.slice(0, 10)} vs ${g.opponent ?? "TBD"}`))
    return { teamName: (team as { name?: string } | null)?.name ?? null, events, games, braikContextBlock: "Braik Team Context:\n" + lines.join("\n") }
  } catch (err) {
    console.error("[Coach B context] getScheduleOnlyContext failed", { teamId, error: err })
    return null
  }
}

async function getGenericTeamSummary(teamId: string): Promise<{
  teamName: string | null
  playerCount: number
  depthChartEntryCount: number
  upcomingEventCount: number
  upcomingGameCount: number
  activeInjuryCount: number
  braikContextBlock: string
} | null> {
  try {
    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
    const { count: playerCount } = await supabase.from("players").select("id", { count: "exact", head: true }).eq("team_id", teamId)
    const { data: depthRows } = await supabase.from("depth_chart_entries").select("id").eq("team_id", teamId)
    const now = new Date().toISOString()
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: eventRows } = await supabase.from("events").select("id").eq("team_id", teamId).gte("start", now).lte("start", twoWeeks)
    let gameCount = 0
    try {
      const { count } = await supabase.from("games").select("id", { count: "exact", head: true }).eq("team_id", teamId).gte("game_date", now).lte("game_date", twoWeeks)
      gameCount = count ?? 0
    } catch {
      //
    }
    const { data: injuryRows } = await supabase.from("player_injuries").select("id").eq("team_id", teamId).eq("status", "active")
    const lines = [
      `Team: ${(team as { name?: string } | null)?.name ?? "Unknown"} (ID: ${teamId})`,
      `Roster: ${playerCount ?? 0} players`,
      `Depth chart entries: ${(depthRows ?? []).length}`,
      `Upcoming events: ${(eventRows ?? []).length}`,
      `Upcoming games: ${gameCount}`,
      `Active injuries: ${(injuryRows ?? []).length}`,
    ]
    return {
      teamName: (team as { name?: string } | null)?.name ?? null,
      playerCount: playerCount ?? 0,
      depthChartEntryCount: (depthRows ?? []).length,
      upcomingEventCount: (eventRows ?? []).length,
      upcomingGameCount: gameCount,
      activeInjuryCount: (injuryRows ?? []).length,
      braikContextBlock: "Braik Team Context:\n" + lines.join("\n"),
    }
  } catch (err) {
    console.error("[Coach B context] getGenericTeamSummary failed", { teamId, error: err })
    return null
  }
}

/**
 * Fetch schedule-focused context (events + games). Kept for backward compatibility.
 */
export async function getScheduleContext(teamId: string): Promise<{
  events: Array<{ title: string; start: string; type: string }>
  games: Array<{ opponent: string | null; date: string; gameType: string | null }>
} | null> {
  const ctx = await getScheduleOnlyContext(teamId)
  if (!ctx) return null
  return {
    events: ctx.events,
    games: ctx.games,
  }
}
