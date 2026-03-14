import type { ContextModuleInput, ScheduleContext, OpponentTendencyContext } from "./types"

export async function getScheduleContext(input: ContextModuleInput): Promise<ScheduleContext[] | null> {
  const { teamId, entities, supabase } = input
  try {
    const now = new Date().toISOString()
    let end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    if (entities.dateTimeRefs.some((d) => d === "this week" || d === "next game")) {
      end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }

    let events: ScheduleContext[] = []
    const eventRes = await supabase
      .from("events")
      .select("id, title, start, end, event_type, location, description")
      .eq("team_id", teamId)
      .gte("start", now)
      .lte("start", end)
      .order("start")
      .limit(25)
    if (!eventRes.error && eventRes.data) {
      events = (eventRes.data as Array<{ id: string; title: string; start: string; end?: string; event_type: string; location?: string; description?: string }>).map((e) => ({
        id: e.id,
        title: e.title ?? "",
        type: (e.event_type === "PRACTICE" ? "practice" : "event") as "event" | "game" | "practice",
        start: e.start,
        end: e.end ?? null,
        opponent: null,
        location: e.location ?? null,
        notes: e.description ?? null,
      }))
    }

    let games: ScheduleContext[] = []
    try {
      const { data: gameRows, error: gameErr } = await supabase
        .from("games")
        .select("id, opponent, game_date, game_type, location, notes")
        .eq("team_id", teamId)
        .gte("game_date", now)
        .lte("game_date", end)
        .order("game_date")
        .limit(15)
      if (!gameErr && gameRows) {
        games = (gameRows as Array<{ id: string; opponent: string | null; game_date: string; game_type: string | null; location?: string; notes?: string }>).map((g) => ({
          id: g.id,
          title: `Game vs ${g.opponent ?? "TBD"}`,
          type: "game" as const,
          start: g.game_date,
          end: null,
          opponent: g.opponent,
          location: g.location ?? null,
          notes: g.notes ?? null,
        }))
      }
    } catch {
      //
    }

    const schedule = [...events, ...games].sort((a, b) => a.start.localeCompare(b.start))
    return schedule
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[braik-ai] getScheduleContext failed", { teamId, message: msg })
    return null
  }
}

/** Fetch structured opponent tendencies for the next game opponent (for Coach B matchup/play fit). */
export async function getOpponentTendenciesForNextGame(
  teamId: string,
  schedule: ScheduleContext[],
  supabase: ContextModuleInput["supabase"]
): Promise<OpponentTendencyContext[]> {
  const nextGame = schedule.find((s) => s.type === "game")
  const opponent = nextGame?.opponent?.trim()
  if (!opponent) return []
  try {
    const { data: rows, error } = await supabase
      .from("opponent_tendencies")
      .select("opponent_name, tendency_category, down_distance_tendency, coverage_tendency, pressure_tendency, run_pass_tendency, red_zone_tendency, notes")
      .eq("team_id", teamId)
      .ilike("opponent_name", `%${opponent}%`)
      .limit(20)
    if (error || !rows?.length) return []
    return (rows as Array<{
      opponent_name: string
      tendency_category?: string | null
      down_distance_tendency?: string | null
      coverage_tendency?: string | null
      pressure_tendency?: string | null
      run_pass_tendency?: string | null
      red_zone_tendency?: string | null
      notes?: string | null
    }>).map((r) => ({
      opponentName: r.opponent_name,
      tendencyCategory: r.tendency_category ?? null,
      downDistanceTendency: r.down_distance_tendency ?? null,
      coverageTendency: r.coverage_tendency ?? null,
      pressureTendency: r.pressure_tendency ?? null,
      runPassTendency: r.run_pass_tendency ?? null,
      redZoneTendency: r.red_zone_tendency ?? null,
      notes: r.notes ?? null,
    }))
  } catch {
    return []
  }
}
