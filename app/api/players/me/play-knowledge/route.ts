import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

const STATUSES = ["not_started", "viewed", "completed", "quiz_passed"] as const

/**
 * GET /api/players/me/play-knowledge?programId=xxx
 * Returns the current user's play knowledge for the program (player must belong to a team in that program).
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const programId = searchParams.get("programId")
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: player } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: "Player profile not found" }, { status: 404 })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("program_id")
      .eq("id", player.team_id)
      .maybeSingle()

    if (!team || (team as { program_id?: string }).program_id !== programId) {
      return NextResponse.json({ error: "You are not in this program" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("player_play_knowledge")
      .select("id, player_id, play_id, program_id, status, quiz_score, last_viewed_at, completed_at, updated_at")
      .eq("player_id", player.id)
      .eq("program_id", programId)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("[GET /api/players/me/play-knowledge]", error)
      return NextResponse.json({ error: "Failed to load play knowledge" }, { status: 500 })
    }

    const knowledge = (data ?? []).map((k) => ({
      id: k.id,
      playId: k.play_id,
      programId: k.program_id,
      status: k.status,
      quizScore: k.quiz_score,
      lastViewedAt: k.last_viewed_at,
      completedAt: k.completed_at,
      updatedAt: k.updated_at,
    }))

    return NextResponse.json({ knowledge })
  } catch (err) {
    console.error("[GET /api/players/me/play-knowledge]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/players/me/play-knowledge
 * Update current user's play knowledge (status, quiz_score, last_viewed_at, completed_at).
 * Body: { playId, programId, status?, quizScore?, lastViewedAt?, completedAt? }
 * Only the player's own record can be updated.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      playId: string
      programId: string
      status?: (typeof STATUSES)[number]
      quizScore?: number | null
      lastViewedAt?: string | null
      completedAt?: string | null
    }

    const { playId, programId, status, quizScore, lastViewedAt, completedAt } = body
    if (!playId || !programId) {
      return NextResponse.json({ error: "playId and programId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: player } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: "Player profile not found" }, { status: 404 })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("program_id")
      .eq("id", player.team_id)
      .maybeSingle()

    if (!team || (team as { program_id?: string }).program_id !== programId) {
      return NextResponse.json({ error: "You are not in this program" }, { status: 403 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status && STATUSES.includes(status)) updates.status = status
    if (quizScore !== undefined) updates.quiz_score = quizScore
    if (lastViewedAt !== undefined) updates.last_viewed_at = lastViewedAt
    if (completedAt !== undefined) updates.completed_at = completedAt

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    let row: { id: string; status: string; quiz_score: number | null; last_viewed_at: string | null; completed_at: string | null; updated_at: string }
    const { data: updated, error: updateError } = await supabase
      .from("player_play_knowledge")
      .update(updates)
      .eq("player_id", player.id)
      .eq("play_id", playId)
      .eq("program_id", programId)
      .select("id, status, quiz_score, last_viewed_at, completed_at, updated_at")
      .single()

    if (updateError && updateError.code === "PGRST116") {
      const insertPayload = {
        player_id: player.id,
        play_id: playId,
        program_id: programId,
        status: status ?? "viewed",
        quiz_score: quizScore ?? null,
        last_viewed_at: lastViewedAt ?? new Date().toISOString(),
        completed_at: completedAt ?? null,
      }
      const { data: inserted, error: insertError } = await supabase
        .from("player_play_knowledge")
        .insert(insertPayload)
        .select("id, status, quiz_score, last_viewed_at, completed_at, updated_at")
        .single()
      if (insertError) {
        console.error("[PATCH /api/players/me/play-knowledge] insert", insertError)
        return NextResponse.json({ error: "Failed to create play knowledge" }, { status: 500 })
      }
      row = inserted as typeof row
    } else if (updateError) {
      console.error("[PATCH /api/players/me/play-knowledge]", updateError)
      return NextResponse.json({ error: "Failed to update play knowledge" }, { status: 500 })
    } else {
      row = updated as typeof row
    }

    return NextResponse.json({
      id: row.id,
      status: row.status,
      quizScore: row.quiz_score,
      lastViewedAt: row.last_viewed_at,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    })
  } catch (err) {
    console.error("[PATCH /api/players/me/play-knowledge]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
