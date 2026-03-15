import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

/**
 * GET /api/programs/[programId]/evaluations?playerId=xxx
 * List evaluations for the program. Optional playerId filter.
 * Coaches only.
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
      .from("player_evaluations")
      .select("id, player_id, program_id, practice_grade, effort_grade, playbook_mastery, coach_notes, created_by_user_id, created_at")
      .eq("program_id", programId)
      .order("created_at", { ascending: false })

    if (playerId) {
      query = query.eq("player_id", playerId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[GET /api/programs/[programId]/evaluations]", error)
      return NextResponse.json({ error: "Failed to load evaluations" }, { status: 500 })
    }

    const evaluations = (data ?? []).map((e) => ({
      id: e.id,
      playerId: e.player_id,
      programId: e.program_id,
      practiceGrade: e.practice_grade,
      effortGrade: e.effort_grade,
      playbookMastery: e.playbook_mastery,
      coachNotes: e.coach_notes,
      createdByUserId: e.created_by_user_id,
      createdAt: e.created_at,
    }))

    return NextResponse.json({ evaluations })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/programs/[programId]/evaluations]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/programs/[programId]/evaluations
 * Create a player evaluation. Coaches only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { programId } = await params
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const body = (await request.json()) as {
      playerId: string
      practiceGrade?: string | null
      effortGrade?: string | null
      playbookMastery?: string | null
      coachNotes?: string | null
    }

    const { playerId, practiceGrade, effortGrade, playbookMastery, coachNotes } = body
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
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
      .eq("id", player.team_id)
      .maybeSingle()

    if (!team || (team as { program_id?: string }).program_id !== programId) {
      return NextResponse.json({ error: "Player is not in this program" }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from("player_evaluations")
      .insert({
        player_id: playerId,
        program_id: programId,
        practice_grade: practiceGrade && String(practiceGrade).trim() ? String(practiceGrade).trim() : null,
        effort_grade: effortGrade && String(effortGrade).trim() ? String(effortGrade).trim() : null,
        playbook_mastery: playbookMastery && String(playbookMastery).trim() ? String(playbookMastery).trim() : null,
        coach_notes: coachNotes && String(coachNotes).trim() ? String(coachNotes).trim() : null,
        created_by_user_id: session.user.id,
      })
      .select("id, player_id, program_id, practice_grade, effort_grade, playbook_mastery, coach_notes, created_at")
      .single()

    if (error) {
      console.error("[POST /api/programs/[programId]/evaluations]", error)
      return NextResponse.json({ error: "Failed to create evaluation" }, { status: 500 })
    }

    return NextResponse.json({
      id: row.id,
      playerId: row.player_id,
      programId: row.program_id,
      practiceGrade: row.practice_grade,
      effortGrade: row.effort_grade,
      playbookMastery: row.playbook_mastery,
      coachNotes: row.coach_notes,
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
    console.error("[POST /api/programs/[programId]/evaluations]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
