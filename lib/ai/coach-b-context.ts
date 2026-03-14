/**
 * Coach B context: fetch Braik team data from Supabase for AI prompts.
 * Used by app/api/ai/chat/route.ts to ground Coach B in real roster, schedule, depth chart, injuries.
 */

import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type QuestionType =
  | "roster"
  | "schedule"
  | "depth_chart"
  | "scouting"
  | "qb_start"
  | "general"

/**
 * Detect the topic of the user question to fetch only relevant data.
 */
export function detectQuestionType(message: string): QuestionType {
  const lower = message.toLowerCase().trim()
  // QB / starter decision
  if (
    /\b(qb|quarterback|start|starter|who should i start|which .* start)\b/.test(lower) ||
    /\b(start which (qb|quarterback))\b/.test(lower)
  ) {
    return "qb_start"
  }
  // Depth chart
  if (
    /\b(depth chart|depthchart|depth|first string|second string|starter)\b/.test(lower)
  ) {
    return "depth_chart"
  }
  // Schedule / events / games
  if (
    /\b(schedule|game|games|when (do we|are we)|next (game|week)|opponent|event|events|calendar)\b/.test(lower)
  ) {
    return "schedule"
  }
  // Roster / players
  if (
    /\b(roster|player|players|who('s| is) on|injured|injury|availability|health)\b/.test(lower)
  ) {
    return "roster"
  }
  // Scouting / play suggestion
  if (
    /\b(play|plays|scout|suggest|formation|call)\b/.test(lower)
  ) {
    return "scouting"
  }
  return "general"
}

export interface TeamContextSummary {
  teamName: string | null
  playerCount: number
  qbCount: number
  depthChartEntryCount: number
  upcomingEventCount: number
  upcomingGameCount: number
  activeInjuryCount: number
  /** Formatted text/JSON for the prompt */
  braikContextBlock: string
}

/**
 * Fetch team context from Supabase and build a prompt-ready summary.
 * On failure, returns null and logs; caller should fall back to generic behavior.
 */
export async function getTeamContext(
  teamId: string,
  message: string
): Promise<TeamContextSummary | null> {
  const questionType = detectQuestionType(message)
  try {
    const supabase = getSupabaseServer()

    // Team basic info
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("id, name")
      .eq("id", teamId)
      .maybeSingle()

    if (teamErr) {
      console.error("[Coach B context] team fetch failed", { teamId, error: teamErr.message })
      return null
    }

    const teamName = team?.name ?? null

    // Roster: always fetch for roster/qb_start/depth_chart/general; optional columns via type cast
    const playerSelect =
      "id, first_name, last_name, jersey_number, position_group, status, notes"
    const { data: playerRows, error: playersErr } = await supabase
      .from("players")
      .select(playerSelect)
      .eq("team_id", teamId)
      .order("last_name", { ascending: true })

    if (playersErr) {
      console.error("[Coach B context] players fetch failed", { teamId, error: playersErr.message })
    }
    const players = (playerRows ?? []) as Array<{
      id: string
      first_name: string | null
      last_name: string | null
      jersey_number: number | null
      position_group: string | null
      status: string | null
      notes: string | null
    }>
    const playerCount = players.length

    // Health status if column exists (optional)
    let healthByPlayerId = new Map<string, string>()
    try {
      const { data: healthRows } = await supabase
        .from("players")
        .select("id, health_status")
        .eq("team_id", teamId)
      if (healthRows) {
        healthByPlayerId = new Map(
          (healthRows as Array<{ id: string; health_status?: string }>).map((r) => [
            r.id,
            (r.health_status as string) ?? "active",
          ])
        )
      }
    } catch {
      // health_status column may not exist
    }

    const qbs = players.filter(
      (p) =>
        p.position_group &&
        /qb|quarterback/i.test(p.position_group)
    )
    const qbCount = qbs.length

    // Depth chart (for qb_start, depth_chart, roster)
    let depthChartEntries: Array<{
      unit: string
      position: string
      string: number
      player_id: string | null
    }> = []
    const { data: depthRows, error: depthErr } = await supabase
      .from("depth_chart_entries")
      .select("unit, position, string, player_id")
      .eq("team_id", teamId)
      .order("unit")
      .order("position")
      .order("string")

    if (!depthErr && depthRows) {
      depthChartEntries = depthRows as typeof depthChartEntries
    }

    // Upcoming events (next 14 days)
    const now = new Date().toISOString()
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    let events: Array<{ title: string; start: string; event_type: string }> = []
    const { data: eventRows, error: eventsErr } = await supabase
      .from("events")
      .select("title, start, event_type")
      .eq("team_id", teamId)
      .gte("start", now)
      .lte("start", twoWeeks)
      .order("start", { ascending: true })
      .limit(10)

    if (!eventsErr && eventRows) {
      events = eventRows as typeof events
    }
    const upcomingEventCount = events.length

    // Upcoming games (from games table if exists)
    let games: Array<{ opponent: string | null; game_date: string; game_type: string | null }> = []
    try {
      const { data: gameRows, error: gamesErr } = await supabase
        .from("games")
        .select("opponent, game_date, game_type")
        .eq("team_id", teamId)
        .gte("game_date", now)
        .lte("game_date", twoWeeks)
        .order("game_date", { ascending: true })
        .limit(5)
      if (!gamesErr && gameRows) {
        games = gameRows as typeof games
      }
    } catch {
      // games table may not exist or be empty
    }
    const upcomingGameCount = games.length

    // Active injuries
    let injuries: Array<{
      player_id: string
      injury_reason: string
      expected_return_date: string | null
      players?: { first_name: string; last_name: string } | null
    }> = []
    const { data: injuryRows, error: injuriesErr } = await supabase
      .from("player_injuries")
      .select("player_id, injury_reason, expected_return_date, players(first_name, last_name)")
      .eq("team_id", teamId)
      .eq("status", "active")
      .order("injury_date", { ascending: false })

    if (!injuriesErr && injuryRows) {
      injuries = injuryRows as typeof injuries
    }
    const activeInjuryCount = injuries.length

    // Build prompt block: include data relevant to question type
    const sections: string[] = []
    sections.push(`Team: ${teamName ?? "Unknown"} (ID: ${teamId})`)
    sections.push(`Roster: ${playerCount} players`)

    if (questionType === "qb_start" || questionType === "roster" || questionType === "depth_chart" || questionType === "general") {
      const qbList =
        qbCount > 0
          ? qbs
              .map((q) => {
                const health = healthByPlayerId.get(q.id) ?? "active"
                const inj = injuries.find((i) => i.player_id === q.id)
                const injNote = inj
                  ? `; INJURED: ${inj.injury_reason}${inj.expected_return_date ? ` (expected return: ${inj.expected_return_date.slice(0, 10)})` : ""}`
                  : health !== "active" ? `; health: ${health}` : ""
                return `- ${q.first_name ?? ""} ${q.last_name ?? ""} #${q.jersey_number ?? "—"} (${q.position_group ?? "—"})${injNote}`
              })
              .join("\n")
          : "No QBs on roster in Braik."
      sections.push(`\nQuarterbacks (${qbCount}):\n${qbList}`)
    }

    if (questionType === "qb_start" || questionType === "depth_chart" || questionType === "general") {
      const depthByPosition = depthChartEntries
        .filter((e) => e.position && /qb|quarterback/i.test(e.position))
        .slice(0, 10)
      if (depthByPosition.length > 0) {
        const depthList = depthByPosition
          .map(
            (e) =>
              `  ${e.unit} ${e.position} string ${e.string}: player_id=${e.player_id ?? "—"}`
          )
          .join("\n")
        sections.push(`\nDepth chart (QB-relevant):\n${depthList}`)
      } else {
        sections.push("\nDepth chart: No QB depth chart entries in Braik.")
      }
    }

    if (questionType === "schedule" || questionType === "general") {
      if (events.length > 0) {
        const eventList = events
          .map((e) => `  ${e.start.slice(0, 10)} ${e.event_type ?? "event"}: ${e.title}`)
          .join("\n")
        sections.push(`\nUpcoming events (next 14 days, ${events.length}):\n${eventList}`)
      } else {
        sections.push("\nUpcoming events: None in Braik for next 14 days.")
      }
      if (games.length > 0) {
        const gameList = games
          .map((g) => `  ${g.game_date.slice(0, 10)} ${g.game_type ?? "game"} vs ${g.opponent ?? "TBD"}`)
          .join("\n")
        sections.push(`\nUpcoming games (${games.length}):\n${gameList}`)
      }
    }

    if (activeInjuryCount > 0 && (questionType === "roster" || questionType === "qb_start" || questionType === "general")) {
      const injuryList = injuries
        .map((i) => {
          const name = i.players ? `${i.players.first_name} ${i.players.last_name}` : i.player_id
          return `  - ${name}: ${i.injury_reason}${i.expected_return_date ? ` (return ~${i.expected_return_date.slice(0, 10)})` : ""}`
        })
        .join("\n")
      sections.push(`\nActive injuries (${activeInjuryCount}):\n${injuryList}`)
    }

    const braikContextBlock = "Braik Team Context:\n" + sections.join("\n")

    return {
      teamName,
      playerCount,
      qbCount,
      depthChartEntryCount: depthChartEntries.length,
      upcomingEventCount,
      upcomingGameCount,
      activeInjuryCount,
      braikContextBlock,
    }
  } catch (err) {
    console.error("[Coach B context] getTeamContext failed", { teamId, error: err })
    return null
  }
}

/**
 * Fetch quarterback-focused context (roster QBs, depth, injuries, next game).
 * Used when question type is qb_start.
 */
export async function getQuarterbackContext(teamId: string): Promise<{
  qbs: Array<{ name: string; jersey: number | null; position: string; health: string }>
  depthChartQBs: Array<{ unit: string; position: string; string: number; playerId: string | null }>
  injuries: Array<{ playerName: string; reason: string; expectedReturn: string | null }>
  nextGame: { opponent: string | null; date: string } | null
} | null> {
  const summary = await getTeamContext(teamId, "which QB should I start")
  if (!summary) return null
  const supabase = getSupabaseServer()

  const { data: playerRows } = await supabase
    .from("players")
    .select("id, first_name, last_name, jersey_number, position_group")
    .eq("team_id", teamId)
  const players = (playerRows ?? []) as Array<{
    id: string
    first_name: string | null
    last_name: string | null
    jersey_number: number | null
    position_group: string | null
  }>
  const qbs = players.filter((p) => p.position_group && /qb|quarterback/i.test(p.position_group))

  let healthMap = new Map<string, string>()
  try {
    const { data: h } = await supabase.from("players").select("id, health_status").eq("team_id", teamId)
    if (h) healthMap = new Map((h as Array<{ id: string; health_status?: string }>).map((r) => [r.id, r.health_status ?? "active"]))
  } catch {
    //
  }

  const { data: depthRows } = await supabase
    .from("depth_chart_entries")
    .select("unit, position, string, player_id")
    .eq("team_id", teamId)
  const depthChartQBs = ((depthRows ?? []) as Array<{ unit: string; position: string; string: number; player_id: string | null }>)
    .filter((e) => e.position && /qb|quarterback/i.test(e.position))
    .map((e) => ({ unit: e.unit, position: e.position, string: e.string, playerId: e.player_id }))

  const { data: injuryRows } = await supabase
    .from("player_injuries")
    .select("player_id, injury_reason, expected_return_date, players(first_name, last_name)")
    .eq("team_id", teamId)
    .eq("status", "active")
  const injuries = ((injuryRows ?? []) as Array<{
    player_id: string
    injury_reason: string
    expected_return_date: string | null
    players?: { first_name: string; last_name: string } | null
  }>).map((i) => ({
    playerName: i.players ? `${i.players.first_name} ${i.players.last_name}` : i.player_id,
    reason: i.injury_reason,
    expectedReturn: i.expected_return_date,
  }))

  let nextGame: { opponent: string | null; date: string } | null = null
  try {
    const now = new Date().toISOString()
    const { data: gameRows } = await supabase
      .from("games")
      .select("opponent, game_date")
      .eq("team_id", teamId)
      .gte("game_date", now)
      .order("game_date", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (gameRows) {
      const g = gameRows as { opponent: string | null; game_date: string }
      nextGame = { opponent: g.opponent ?? null, date: g.game_date }
    }
  } catch {
    //
  }

  return {
    qbs: qbs.map((q) => ({
      name: `${q.first_name ?? ""} ${q.last_name ?? ""}`.trim() || "Unknown",
      jersey: q.jersey_number,
      position: q.position_group ?? "QB",
      health: healthMap.get(q.id) ?? "active",
    })),
    depthChartQBs,
    injuries,
    nextGame,
  }
}

/**
 * Fetch schedule-focused context (events + games).
 */
export async function getScheduleContext(teamId: string): Promise<{
  events: Array<{ title: string; start: string; type: string }>
  games: Array<{ opponent: string | null; date: string; gameType: string | null }>
} | null> {
  try {
    const supabase = getSupabaseServer()
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

    return { events, games }
  } catch (err) {
    console.error("[Coach B context] getScheduleContext failed", { teamId, error: err })
    return null
  }
}
