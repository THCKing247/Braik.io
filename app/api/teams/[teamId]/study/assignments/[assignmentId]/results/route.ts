import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/** GET — per-player progress for one assignment (single query + join). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; assignmentId: string }> }
) {
  try {
    const { teamId, assignmentId } = await params
    if (!teamId || !assignmentId) return NextResponse.json({ error: "Bad request" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const { data: a } = await supabase
      .from("study_assignments")
      .select("id, title, assignment_type, due_date")
      .eq("id", assignmentId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: rows, error } = await supabase
      .from("study_assignment_players")
      .select(
        `player_id, status, opened_at, review_started_at, review_completed_at, review_material_opened_at,
         quiz_started_at, quiz_submitted_at, score_percent, correct_count, total_questions,
         time_spent_seconds, completed_at,
         players ( first_name, last_name, position_group )`
      )
      .eq("assignment_id", assignmentId)

    if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })

    return NextResponse.json({ assignment: a, players: rows ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
