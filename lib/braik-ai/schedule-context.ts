import type { ContextModuleInput, ScheduleContext } from "./types"

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
