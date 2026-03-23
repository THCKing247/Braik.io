/**
 * POST — generate AI recap from structured facts (coaches). Persists to games.ai_recap.
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { mapDbGameRowToTeamGameRow } from "@/lib/team-game-row-map"
import { buildCumulativeRecordBeforeMap, inferScheduleStatus } from "@/lib/team-schedule-games"
import { formatRecordLine } from "@/lib/records/compute-team-record"
import { computeTeamTrends } from "@/lib/schedule-team-trends"
import { buildGameRecapFacts } from "@/lib/game-recap-build"
import { generateGameRecapWithOpenAI } from "@/lib/game-recap-openai"
import { isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import type { GameStatsRowInput } from "@/lib/schedule-player-of-game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string; gameId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameId } = await params
    if (!teamId?.trim() || !gameId?.trim()) {
      return NextResponse.json({ error: "teamId and gameId are required" }, { status: 400 })
    }

    if (!isOpenAIConfigured()) {
      return NextResponse.json({ error: "AI recap is not configured (missing API key)." }, { status: 503 })
    }

    const body = (await request.json().catch(() => ({}))) as { weekLabel?: string }
    const weekLabel = typeof body.weekLabel === "string" ? body.weekLabel.trim() : undefined

    const supabase = getSupabaseServer()
    await requireTeamPermission(teamId, "edit_roster")

    const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
    const teamName = (team?.name as string | undefined)?.trim() || "Our team"

    const { data: gameRow, error: gErr } = await supabase
      .from("games")
      .select(
        "id, opponent, game_date, location, game_type, result, notes, conference_game, team_score, opponent_score, confirmed_by_coach, season_id, seasons(year), q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away, potg_override_player_id"
      )
      .eq("id", gameId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (gErr || !gameRow) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    const game = mapDbGameRowToTeamGameRow(gameRow as Record<string, unknown>)
    if (inferScheduleStatus(game) !== "completed") {
      return NextResponse.json({ error: "Recap is only available for completed games." }, { status: 400 })
    }

    const { data: allRows, error: allErr } = await supabase
      .from("games")
      .select(
        "id, opponent, game_date, location, game_type, result, notes, conference_game, team_score, opponent_score, confirmed_by_coach, season_id, seasons(year), q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away"
      )
      .eq("team_id", teamId)
      .order("game_date", { ascending: true })

    if (allErr) {
      console.error("[POST ai-recap] load games", allErr)
      return NextResponse.json({ error: "Failed to load schedule context" }, { status: 500 })
    }

    const allGames = (allRows ?? []).map((r) => mapDbGameRowToTeamGameRow(r as Record<string, unknown>))
    const trends = computeTeamTrends(allGames)
    const recBefore = buildCumulativeRecordBeforeMap(allGames)
    const rb = recBefore.get(game.id)
    const recordBeforeGame = rb != null ? formatRecordLine(rb) : undefined

    const { data: statRows } = await supabase
      .from("player_game_stats")
      .select("player_id, stats")
      .eq("game_id", gameId)
      .eq("team_id", teamId)

    const pids = [...new Set((statRows ?? []).map((x) => x.player_id as string))]
    const { data: players } =
      pids.length > 0
        ? await supabase
            .from("players")
            .select("id, first_name, last_name, jersey_number, position_group")
            .eq("team_id", teamId)
            .in("id", pids)
        : { data: [] as { id: string; first_name: string; last_name: string; jersey_number: number | null; position_group: string | null }[] }

    const pmap = new Map((players ?? []).map((p) => [p.id as string, p]))
    const playerRows: GameStatsRowInput[] = (statRows ?? []).map((r) => {
      const p = pmap.get(r.player_id as string)
      return {
        playerId: r.player_id as string,
        firstName: (p?.first_name as string) ?? "",
        lastName: (p?.last_name as string) ?? "",
        jerseyNumber: (p?.jersey_number as number | null) ?? null,
        positionGroup: (p?.position_group as string | null) ?? null,
        stats: (r.stats as Record<string, unknown>) ?? {},
      }
    })

    const oid = (gameRow as { potg_override_player_id?: string | null }).potg_override_player_id
    let potgOverride: { firstName: string; lastName: string; reason?: string } | null = null
    if (oid) {
      const { data: op } = await supabase
        .from("players")
        .select("first_name, last_name")
        .eq("id", oid)
        .eq("team_id", teamId)
        .maybeSingle()
      if (op) {
        potgOverride = {
          firstName: (op.first_name as string) ?? "",
          lastName: (op.last_name as string) ?? "",
          reason: "Selected by coach.",
        }
      }
    }

    const facts = buildGameRecapFacts({
      teamName,
      opponent: game.opponent,
      game,
      weekLabel,
      recordBeforeGame,
      trends,
      playerRows,
      potgOverride,
    })

    const text = await generateGameRecapWithOpenAI(facts)
    const now = new Date().toISOString()

    const { error: upErr } = await supabase
      .from("games")
      .update({ ai_recap: text, ai_recap_at: now, updated_at: now })
      .eq("id", gameId)
      .eq("team_id", teamId)

    if (upErr) {
      console.error("[POST ai-recap] update", upErr)
      return NextResponse.json({ error: "Failed to save recap" }, { status: 500 })
    }

    revalidatePath("/dashboard/schedule")

    return NextResponse.json({ recap: text, aiRecapAt: now })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    console.error("[POST ai-recap]", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
