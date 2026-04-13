import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { hydrateStudyAssignmentItems } from "@/lib/study-item-links"
import { recomputeStudyPlayerRow } from "@/lib/study-player-sync"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { playerFacingStatus, type StudyAssignmentType } from "@/lib/study-assignment-logic"
import { sanitizeQuestionForPlayer, type QuizQuestionForGrading } from "@/lib/study-quiz-utils"

/** GET — one assignment for player: hydrated items + quiz payload (lazy detail). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; assignmentId: string }> }
) {
  try {
    const { teamId, assignmentId } = await params
    if (!teamId || !assignmentId) return NextResponse.json({ error: "Bad request" }, { status: 400 })

    const session = await getServerSession()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { membership } = await requireTeamAccess(teamId)
    if (canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Use coach detail API" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: sap } = await supabase
      .from("study_assignment_players")
      .select(
        "status, opened_at, review_started_at, review_completed_at, quiz_started_at, quiz_submitted_at, score_percent, correct_count, total_questions, time_spent_seconds"
      )
      .eq("assignment_id", assignmentId)
      .eq("player_id", player.id)
      .maybeSingle()

    if (!sap) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: assignment } = await supabase
      .from("study_assignments")
      .select("id, title, due_date, assignment_type, publish_status, review_player_summary")
      .eq("id", assignmentId)
      .eq("team_id", teamId)
      .eq("publish_status", "published")
      .maybeSingle()

    if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!sap.opened_at) {
      const now = new Date().toISOString()
      await supabase
        .from("study_assignment_players")
        .update({
          opened_at: now,
          review_started_at: now,
          status: "in_progress",
          last_activity_at: now,
        })
        .eq("assignment_id", assignmentId)
        .eq("player_id", player.id)
        .is("opened_at", null)
      await recomputeStudyPlayerRow(supabase, assignmentId, player.id)
    }

    const { data: sapFresh } = await supabase
      .from("study_assignment_players")
      .select(
        "status, opened_at, review_started_at, review_completed_at, quiz_started_at, quiz_submitted_at, score_percent, correct_count, total_questions, time_spent_seconds"
      )
      .eq("assignment_id", assignmentId)
      .eq("player_id", player.id)
      .maybeSingle()

    const { data: rawItems } = await supabase
      .from("study_assignment_items")
      .select("item_type, item_id, sort_order")
      .eq("assignment_id", assignmentId)
      .order("sort_order")

    const items = await hydrateStudyAssignmentItems(supabase, teamId, rawItems ?? [])

    const assignmentType = (assignment.assignment_type ?? "review") as StudyAssignmentType
    const prog = sapFresh ?? sap
    const displayStatus = playerFacingStatus({
      assignmentType,
      dueDate: assignment.due_date as string | null,
      openedAt: prog.opened_at as string | null,
      reviewCompletedAt: prog.review_completed_at as string | null,
      quizSubmittedAt: prog.quiz_submitted_at as string | null,
      scorePercent: prog.score_percent as number | null,
    })

    let quizPayload: Record<string, unknown> | null = null
    if (assignmentType === "quiz" || assignmentType === "mixed") {
      const { data: quiz } = await supabase.from("mastery_quizzes").select("id").eq("assignment_id", assignmentId).maybeSingle()
      if (quiz?.id) {
        const { data: result } = await supabase
          .from("mastery_results")
          .select("score, answers, taken_at")
          .eq("quiz_id", quiz.id)
          .eq("player_id", player.id)
          .maybeSingle()

        if (result) {
          quizPayload = {
            quizId: quiz.id,
            status: "submitted",
            scorePercent: Number(result.score),
            answers: result.answers,
            takenAt: result.taken_at,
          }
        } else {
          const { data: qs } = await supabase
            .from("mastery_questions")
            .select("id, question_text, question_type, options, correct_index, answer_key, sort_order")
            .eq("quiz_id", quiz.id)
            .order("sort_order")
          const forPlayer = (qs ?? []).map((q) =>
            sanitizeQuestionForPlayer(q as unknown as QuizQuestionForGrading)
          )
          quizPayload = {
            quizId: quiz.id,
            status: "pending",
            questions: forPlayer,
          }
        }
      }
    }

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        due_date: assignment.due_date,
        assignment_type: assignmentType,
        review_player_summary: (assignment.review_player_summary as string | null | undefined) ?? null,
      },
      myProgress: { ...prog, displayStatus },
      items,
      quiz: quizPayload,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
