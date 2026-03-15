import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

function clampScore(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n)))
}

/**
 * POST /api/players/development
 * Log development metrics for a player. Coaches only. Program resolved from player's team.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      playerId: string
      strength?: number | null
      speed?: number | null
      footballIQ?: number | null
      leadership?: number | null
      discipline?: number | null
      notes?: string | null
    }

    const { playerId, strength, speed, footballIQ, leadership, discipline, notes } = body
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
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

    const strength_score = clampScore(strength)
    const speed_score = clampScore(speed)
    const football_iq_score = clampScore(footballIQ)
    const leadership_score = clampScore(leadership)
    const discipline_score = clampScore(discipline)
    if (
      strength_score == null &&
      speed_score == null &&
      football_iq_score == null &&
      leadership_score == null &&
      discipline_score == null
    ) {
      return NextResponse.json(
        { error: "At least one score (strength, speed, footballIQ, leadership, discipline) is required" },
        { status: 400 }
      )
    }

    const { data: row, error } = await supabase
      .from("player_development_metrics")
      .insert({
        player_id: playerId,
        program_id: programId,
        strength_score,
        speed_score,
        football_iq_score,
        leadership_score,
        discipline_score,
        coach_notes: notes && String(notes).trim() ? String(notes).trim() : null,
        created_by_user_id: session.user.id,
      })
      .select("id, player_id, program_id, strength_score, speed_score, football_iq_score, leadership_score, discipline_score, coach_notes, created_at")
      .single()

    if (error) {
      console.error("[POST /api/players/development]", error)
      return NextResponse.json({ error: "Failed to save development metrics" }, { status: 500 })
    }

    return NextResponse.json({
      id: row.id,
      playerId: row.player_id,
      programId: row.program_id,
      strength: row.strength_score,
      speed: row.speed_score,
      footballIQ: row.football_iq_score,
      leadership: row.leadership_score,
      discipline: row.discipline_score,
      notes: row.coach_notes,
      createdAt: row.created_at,
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/players/development]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
