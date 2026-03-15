import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const STATUSES = ["not_started", "viewed", "completed", "quiz_passed"] as const

/**
 * POST /api/playbooks/update-progress
 * Coach updates a player's play knowledge (status, quizScore). Coaches only.
 * Body: { playerId, playId, status?, quizScore? }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      playerId: string
      playId: string
      status?: (typeof STATUSES)[number]
      quizScore?: number | null
    }

    const { playerId, playId, status, quizScore } = body
    if (!playerId || !playId) {
      return NextResponse.json({ error: "playerId and playId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: player } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("program_id")
      .eq("id", (player as { team_id: string }).team_id)
      .maybeSingle()

    const programId = (team as { program_id?: string } | null)?.program_id
    if (!programId) {
      return NextResponse.json({ error: "Player is not in a program" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status && STATUSES.includes(status)) updates.status = status
    if (quizScore !== undefined) updates.quiz_score = quizScore
    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "Provide status and/or quizScore to update" }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from("player_play_knowledge")
      .update(updates)
      .eq("player_id", playerId)
      .eq("play_id", playId)
      .eq("program_id", programId)
      .select("id, status, quiz_score, updated_at")
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        const { data: inserted, error: insertErr } = await supabase
          .from("player_play_knowledge")
          .insert({
            player_id: playerId,
            play_id: playId,
            program_id: programId,
            status: status ?? "viewed",
            quiz_score: quizScore ?? null,
          })
          .select("id, status, quiz_score, updated_at")
          .single()
        if (insertErr) {
          console.error("[POST /api/playbooks/update-progress] insert", insertErr)
          return NextResponse.json({ error: "Failed to create progress record" }, { status: 500 })
        }
        return NextResponse.json({
          id: inserted.id,
          status: inserted.status,
          quizScore: inserted.quiz_score,
          updatedAt: inserted.updated_at,
        })
      }
      console.error("[POST /api/playbooks/update-progress]", error)
      return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
    }

    return NextResponse.json({
      id: row.id,
      status: row.status,
      quizScore: row.quiz_score,
      updatedAt: row.updated_at,
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/playbooks/update-progress]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
