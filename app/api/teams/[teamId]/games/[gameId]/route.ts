/**
 * PATCH / DELETE single game for a team (edit_roster).
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { mergeGameScoringPatch, type GamesDbRow } from "@/lib/games-api-scoring"
import { revalidateTeamGamesAndDashboard } from "@/lib/cache/lightweight-get-cache"
import { mapDbGameRowToTeamGameRow } from "@/lib/team-game-row-map"
import { GAMES_SCHEDULE_SELECT } from "@/lib/stats/cached-stats-games"
import { inferScheduleStatus } from "@/lib/team-schedule-games"

const GAME_TYPES = new Set(["regular", "playoff", "scrimmage", "tournament"])
const RESULTS = new Set(["win", "loss", "tie"])

type PatchBody = {
  opponent?: string
  gameDate?: string
  location?: string | null
  gameType?: string | null
  conferenceGame?: boolean
  result?: string | null
  teamScore?: number | null
  opponentScore?: number | null
  notes?: string | null
  confirmedByCoach?: boolean
  q1_home?: number | null
  q2_home?: number | null
  q3_home?: number | null
  q4_home?: number | null
  q1_away?: number | null
  q2_away?: number | null
  q3_away?: number | null
  q4_away?: number | null
  /** Clear with null to use automatic Player of the Game from stats. */
  potgOverridePlayerId?: string | null
}

export async function PATCH(
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

    const supabase = getSupabaseServer()
    const { data: existing } = await supabase
      .from("games")
      .select(
        "id, team_id, location, team_score, opponent_score, result, q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away"
      )
      .eq("id", gameId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const body = (await request.json().catch(() => null)) as PatchBody | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.opponent !== undefined) {
      const o = String(body.opponent).trim()
      if (!o) return NextResponse.json({ error: "opponent cannot be empty" }, { status: 400 })
      patch.opponent = o
    }
    if (body.gameDate !== undefined) {
      const gameMs = Date.parse(String(body.gameDate))
      if (!Number.isFinite(gameMs)) {
        return NextResponse.json({ error: "Invalid gameDate" }, { status: 400 })
      }
      patch.game_date = new Date(gameMs).toISOString()
    }
    if (body.location !== undefined) {
      patch.location = body.location?.trim() || null
    }
    if (body.gameType !== undefined) {
      const gt = body.gameType?.trim().toLowerCase() ?? "regular"
      if (gt && !GAME_TYPES.has(gt)) {
        return NextResponse.json({ error: "Invalid gameType" }, { status: 400 })
      }
      patch.game_type = gt || "regular"
    }
    if (body.conferenceGame !== undefined) {
      patch.conference_game = Boolean(body.conferenceGame)
    }
    if (body.result !== undefined) {
      const r = body.result?.trim().toLowerCase() ?? ""
      patch.result = r && RESULTS.has(r) ? r : null
    }

    const mergedLocation =
      body.location !== undefined
        ? body.location === null || String(body.location).trim() === ""
          ? null
          : String(body.location).trim()
        : ((existing as { location?: string | null }).location ?? null)

    const existingRow: GamesDbRow = {
      location: mergedLocation,
      team_score: (existing as { team_score?: number | null }).team_score ?? null,
      opponent_score: (existing as { opponent_score?: number | null }).opponent_score ?? null,
      q1_home: (existing as { q1_home?: number | null }).q1_home ?? null,
      q2_home: (existing as { q2_home?: number | null }).q2_home ?? null,
      q3_home: (existing as { q3_home?: number | null }).q3_home ?? null,
      q4_home: (existing as { q4_home?: number | null }).q4_home ?? null,
      q1_away: (existing as { q1_away?: number | null }).q1_away ?? null,
      q2_away: (existing as { q2_away?: number | null }).q2_away ?? null,
      q3_away: (existing as { q3_away?: number | null }).q3_away ?? null,
      q4_away: (existing as { q4_away?: number | null }).q4_away ?? null,
    }

    const scoringPatch = mergeGameScoringPatch(body as Record<string, unknown>, existingRow)
    if (Object.keys(scoringPatch).length > 0) {
      Object.assign(patch, scoringPatch)
    }
    if (body.notes !== undefined) {
      patch.notes = body.notes?.trim() || null
    }
    if (body.confirmedByCoach !== undefined) {
      patch.confirmed_by_coach = Boolean(body.confirmedByCoach)
      patch.confirmed_at = body.confirmedByCoach ? new Date().toISOString() : null
    }

    if (body.potgOverridePlayerId !== undefined) {
      const v = body.potgOverridePlayerId
      if (v === null || v === "") {
        patch.potg_override_player_id = null
      } else {
        const pid = String(v).trim()
        const { data: pl } = await supabase
          .from("players")
          .select("id")
          .eq("id", pid)
          .eq("team_id", teamId)
          .maybeSingle()
        if (!pl) {
          return NextResponse.json({ error: "Player not on this team" }, { status: 400 })
        }
        patch.potg_override_player_id = pid
      }
    }

    const { data: updatedRow, error } = await supabase
      .from("games")
      .update(patch)
      .eq("id", gameId)
      .eq("team_id", teamId)
      .select(GAMES_SCHEDULE_SELECT)
      .maybeSingle()

    if (error) {
      console.error("[PATCH game]", error)
      return NextResponse.json({ error: "Failed to update game" }, { status: 500 })
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/schedule")
    revalidateTeamGamesAndDashboard(teamId)

    const game = updatedRow ? mapDbGameRowToTeamGameRow(updatedRow as Record<string, unknown>) : undefined
    if (process.env.NODE_ENV !== "production" && game) {
      // eslint-disable-next-line no-console -- dev-only save pipeline trace
      console.debug("[PATCH game] saved row → UI mapping", {
        gameId,
        patchKeys: Object.keys(patch),
        mapped: {
          teamScore: game.teamScore,
          opponentScore: game.opponentScore,
          result: game.result,
          inferScheduleStatus: inferScheduleStatus(game),
        },
      })
    }
    return NextResponse.json({ success: true, game })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[PATCH game]", err)
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
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

    const supabase = getSupabaseServer()
    const { data: existing } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const { error } = await supabase.from("games").delete().eq("id", gameId).eq("team_id", teamId)
    if (error) {
      console.error("[DELETE game]", error)
      return NextResponse.json({ error: "Failed to delete game" }, { status: 500 })
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/schedule")
    revalidateTeamGamesAndDashboard(teamId)

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[DELETE game]", err)
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 })
  }
}
