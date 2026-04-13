import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { recomputeStudyPlayerRow } from "@/lib/study-player-sync"
import { gradeSubmission, type QuizAnswerPayload, type QuizQuestionForGrading } from "@/lib/study-quiz-utils"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/** POST — submit quiz answers once; automatic grading. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string; assignmentId: string }> }
) {
  try {
    const { teamId, assignmentId } = await params
    if (!teamId || !assignmentId) return NextResponse.json({ error: "Bad request" }, { status: 400 })

    const session = await getServerSession()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { membership } = await requireTeamAccess(teamId)
    if (canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Players only" }, { status: 400 })
    }

    const body = (await request.json()) as { answers?: QuizAnswerPayload[] }
    if (!Array.isArray(body.answers)) return NextResponse.json({ error: "answers required" }, { status: 400 })

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: a } = await supabase
      .from("study_assignments")
      .select("assignment_type, publish_status")
      .eq("id", assignmentId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!a || a.publish_status !== "published") return NextResponse.json({ error: "Not found" }, { status: 404 })
    const at = a.assignment_type as string
    if (at !== "quiz" && at !== "mixed") return NextResponse.json({ error: "No quiz on assignment" }, { status: 400 })

    const { data: sap } = await supabase
      .from("study_assignment_players")
      .select("id")
      .eq("assignment_id", assignmentId)
      .eq("player_id", player.id)
      .maybeSingle()

    if (!sap) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: quiz } = await supabase.from("mastery_quizzes").select("id").eq("assignment_id", assignmentId).maybeSingle()

    if (!quiz?.id) return NextResponse.json({ error: "No quiz" }, { status: 400 })

    const { data: existing } = await supabase
      .from("mastery_results")
      .select("id")
      .eq("quiz_id", quiz.id)
      .eq("player_id", player.id)
      .maybeSingle()

    if (existing) return NextResponse.json({ error: "Already submitted" }, { status: 409 })

    const { data: qs } = await supabase
      .from("mastery_questions")
      .select("id, question_type, correct_index, answer_key, options")
      .eq("quiz_id", quiz.id)
      .order("sort_order")

    const questions = (qs ?? []) as unknown as QuizQuestionForGrading[]
    const { correct, total, scorePercent } = gradeSubmission(questions, body.answers)

    const now = new Date().toISOString()

    const { error: rErr } = await supabase.from("mastery_results").insert({
      quiz_id: quiz.id,
      player_id: player.id,
      score: scorePercent,
      taken_at: now,
      answers: body.answers,
    })

    if (rErr) {
      console.error(rErr)
      return NextResponse.json({ error: "Failed to save result" }, { status: 500 })
    }

    await supabase
      .from("study_assignment_players")
      .update({
        quiz_started_at: now,
        quiz_submitted_at: now,
        score_percent: scorePercent,
        correct_count: correct,
        total_questions: total,
      })
      .eq("assignment_id", assignmentId)
      .eq("player_id", player.id)

    await recomputeStudyPlayerRow(supabase, assignmentId, player.id)

    return NextResponse.json({ scorePercent, correct, total })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
