/**
 * PATCH — apply the same score fields to many scheduled games (coaches).
 * Body: { gameIds: string[], teamScore?: number | null, opponentScore?: number | null }
 * Uses the same rules as PATCH single game: score-only update clears quarter breakdown.
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { mergeGameScoringPatch, type GamesDbRow } from "@/lib/games-api-scoring"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  gameIds?: unknown
  teamScore?: number | null
  opponentScore?: number | null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId?.trim()) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as Body | null
    const rawIds = body?.gameIds
    const gameIds = Array.isArray(rawIds)
      ? rawIds.filter((x): x is string => typeof x === "string" && UUID_REGEX.test(x))
      : []

    if (gameIds.length === 0) {
      return NextResponse.json({ error: "gameIds must be a non-empty array of UUIDs" }, { status: 400 })
    }
    if (gameIds.length > 80) {
      return NextResponse.json({ error: "Too many games (max 80)" }, { status: 400 })
    }

    const hasScore =
      Object.prototype.hasOwnProperty.call(body ?? {}, "teamScore") ||
      Object.prototype.hasOwnProperty.call(body ?? {}, "opponentScore")
    if (!hasScore) {
      return NextResponse.json({ error: "teamScore and/or opponentScore is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    await requireTeamPermission(teamId, "edit_roster")

    const { data: games, error: fetchErr } = await supabase
      .from("games")
      .select(
        "id, location, team_score, opponent_score, q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away"
      )
      .eq("team_id", teamId)
      .in("id", gameIds)

    if (fetchErr) {
      console.error("[PATCH games/bulk] fetch", fetchErr)
      return NextResponse.json({ error: "Failed to load games" }, { status: 500 })
    }

    const found = new Set((games ?? []).map((g) => g.id as string))
    for (const id of gameIds) {
      if (!found.has(id)) {
        return NextResponse.json({ error: `Game ${id} not found on this team` }, { status: 400 })
      }
    }

    const patchBody = {
      teamScore: body?.teamScore,
      opponentScore: body?.opponentScore,
    } as Record<string, unknown>

    let updated = 0
    for (const row of games ?? []) {
      const existingRow: GamesDbRow = {
        location: (row as { location?: string | null }).location ?? null,
        team_score: (row as { team_score?: number | null }).team_score ?? null,
        opponent_score: (row as { opponent_score?: number | null }).opponent_score ?? null,
        q1_home: (row as { q1_home?: number | null }).q1_home ?? null,
        q2_home: (row as { q2_home?: number | null }).q2_home ?? null,
        q3_home: (row as { q3_home?: number | null }).q3_home ?? null,
        q4_home: (row as { q4_home?: number | null }).q4_home ?? null,
        q1_away: (row as { q1_away?: number | null }).q1_away ?? null,
        q2_away: (row as { q2_away?: number | null }).q2_away ?? null,
        q3_away: (row as { q3_away?: number | null }).q3_away ?? null,
        q4_away: (row as { q4_away?: number | null }).q4_away ?? null,
      }

      const scoringPatch = mergeGameScoringPatch(patchBody, existingRow)
      if (Object.keys(scoringPatch).length === 0) continue

      const fullPatch = {
        ...scoringPatch,
        updated_at: new Date().toISOString(),
      }

      const { error: upErr } = await supabase
        .from("games")
        .update(fullPatch)
        .eq("id", row.id as string)
        .eq("team_id", teamId)

      if (upErr) {
        console.error("[PATCH games/bulk] update", upErr)
        return NextResponse.json({ error: "Failed to update games" }, { status: 500 })
      }
      updated++
    }

    revalidatePath("/dashboard/schedule")
    revalidatePath("/dashboard")

    return NextResponse.json({ success: true, updated })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[PATCH games/bulk]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
