import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const STATUSES = ["not_started", "viewed", "completed", "quiz_passed"] as const

/**
 * GET /api/programs/[programId]/play-knowledge?playerId=xxx
 * Coaches: list play knowledge for program; optional playerId filter.
 * Returns knowledge records (player sees only own via /api/players/me/play-knowledge).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get("playerId")

    const supabase = getSupabaseServer()
    let query = supabase
      .from("player_play_knowledge")
      .select("id, player_id, play_id, program_id, status, quiz_score, last_viewed_at, completed_at, updated_at")
      .eq("program_id", programId)
      .order("updated_at", { ascending: false })

    if (playerId) {
      query = query.eq("player_id", playerId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[GET /api/programs/[programId]/play-knowledge]", error)
      return NextResponse.json({ error: "Failed to load play knowledge" }, { status: 500 })
    }

    const knowledge = (data ?? []).map((k) => ({
      id: k.id,
      playerId: k.player_id,
      playId: k.play_id,
      programId: k.program_id,
      status: k.status,
      quizScore: k.quiz_score,
      lastViewedAt: k.last_viewed_at,
      completedAt: k.completed_at,
      updatedAt: k.updated_at,
    }))

    return NextResponse.json({ knowledge })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/programs/[programId]/play-knowledge]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
