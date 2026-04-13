import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { ensureStudyAssignmentPlayerRows } from "@/lib/study-guides-server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { DraftStudyQuestion } from "@/lib/study-coach-b-quiz"
import { validateDraftQuestionsForSave } from "@/lib/study-validate-questions"

async function assertCoachAssignment(supabase: ReturnType<typeof getSupabaseServer>, teamId: string, assignmentId: string) {
  const { data } = await supabase
    .from("study_assignments")
    .select("id, team_id, assignment_type")
    .eq("id", assignmentId)
    .maybeSingle()
  if (!data || data.team_id !== teamId) return null
  return data
}

/** GET — full coach detail: items, quiz + questions (correct answers included). */
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
    const row = await assertCoachAssignment(supabase, teamId, assignmentId)
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const [{ data: assignment }, { data: items }, { data: quiz }] = await Promise.all([
      supabase.from("study_assignments").select("*").eq("id", assignmentId).single(),
      supabase.from("study_assignment_items").select("*").eq("assignment_id", assignmentId).order("sort_order"),
      supabase.from("mastery_quizzes").select("id").eq("assignment_id", assignmentId).maybeSingle(),
    ])

    let questions: unknown[] = []
    if (quiz?.id) {
      const { data: qs } = await supabase
        .from("mastery_questions")
        .select("id, question_text, question_type, options, correct_index, answer_key, sort_order")
        .eq("quiz_id", quiz.id)
        .order("sort_order")
      questions = qs ?? []
    }

    return NextResponse.json({
      assignment,
      items: items ?? [],
      quiz: quiz?.id ? { id: quiz.id, questions } : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/** PATCH — coach updates metadata and/or replaces quiz questions. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; assignmentId: string }> }
) {
  try {
    const { teamId, assignmentId } = await params
    if (!teamId || !assignmentId) return NextResponse.json({ error: "Bad request" }, { status: 400 })

    const auth = await requireTeamAccess(teamId)
    if (!canEditRoster(auth.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const row = await assertCoachAssignment(supabase, teamId, assignmentId)
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = (await request.json()) as {
      title?: string
      dueDate?: string | null
      publishStatus?: "draft" | "published"
      questions?: DraftStudyQuestion[]
    }

    const patch: Record<string, unknown> = {}
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim()
    if (body.dueDate !== undefined) patch.due_date = body.dueDate ? new Date(body.dueDate).toISOString() : null
    if (body.publishStatus === "draft" || body.publishStatus === "published") patch.publish_status = body.publishStatus

    if (Object.keys(patch).length) {
      const { data: before } = await supabase
        .from("study_assignments")
        .select("publish_status")
        .eq("id", assignmentId)
        .single()
      const { error } = await supabase.from("study_assignments").update(patch).eq("id", assignmentId)
      if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 })
      if (body.publishStatus === "published" && before?.publish_status === "draft") {
        await ensureStudyAssignmentPlayerRows(supabase, teamId, assignmentId)
      }
    }

    if (Array.isArray(body.questions)) {
      const assignmentType = row.assignment_type as string
      if (assignmentType !== "quiz" && assignmentType !== "mixed") {
        return NextResponse.json({ error: "Questions only for quiz/mixed assignments" }, { status: 400 })
      }
      const err = validateDraftQuestionsForSave(body.questions)
      if (err) return NextResponse.json({ error: err }, { status: 400 })

      const { data: quiz } = await supabase.from("mastery_quizzes").select("id").eq("assignment_id", assignmentId).maybeSingle()
      if (!quiz?.id) return NextResponse.json({ error: "No quiz on this assignment" }, { status: 400 })

      await supabase.from("mastery_questions").delete().eq("quiz_id", quiz.id)

      const qrows = body.questions.map((q, i) => ({
        quiz_id: quiz.id,
        question_text: q.questionText.trim(),
        question_type: q.questionType,
        options: q.options as object,
        correct_index: q.questionType === "matching" ? null : (q.correctIndex ?? 0),
        answer_key: q.questionType === "matching" ? q.answerKey : null,
        sort_order: i,
      }))

      const { error: insErr } = await supabase.from("mastery_questions").insert(qrows)
      if (insErr) return NextResponse.json({ error: "Failed to replace questions" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
