import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveAssignmentPlayerIds } from "@/lib/study-guides-server"
import { isPlayerAssignmentComplete, type StudyAssignmentType } from "@/lib/study-assignment-logic"
import type { DraftStudyQuestion } from "@/lib/study-coach-b-quiz"
import { validateDraftQuestionsForSave } from "@/lib/study-validate-questions"
import type { StudyItemType } from "@/lib/study-source-context"

type SapRow = {
  assignment_id: string
  status: string
  opened_at: string | null
  review_completed_at: string | null
  quiz_submitted_at: string | null
  score_percent: number | null
}

/**
 * GET — coach assignment summaries (single bulk player row fetch; no N+1).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const { data: assigns, error } = await supabase
      .from("study_assignments")
      .select(
        "id, title, due_date, assigned_to_type, assigned_position_group, assigned_side, assignment_type, publish_status, created_at"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })

    const list = assigns ?? []
    const ids = list.map((a) => a.id)
    if (ids.length === 0) return NextResponse.json({ assignments: [] })

    const { data: sapAll } = await supabase
      .from("study_assignment_players")
      .select("assignment_id, status, opened_at, review_completed_at, quiz_submitted_at, score_percent")
      .in("assignment_id", ids)

    const byAssign = new Map<string, SapRow[]>()
    for (const r of sapAll ?? []) {
      const arr = byAssign.get(r.assignment_id) ?? []
      arr.push(r as SapRow)
      byAssign.set(r.assignment_id, arr)
    }

    const now = Date.now()
    const enriched = list.map((a) => {
      const rows = byAssign.get(a.id) ?? []
      const assignmentType = (a.assignment_type ?? "review") as StudyAssignmentType
      let notStarted = 0
      let inProgress = 0
      let completed = 0
      let overdue = 0
      let scoreSum = 0
      let scoreN = 0
      const dueTs = a.due_date ? new Date(a.due_date as string).getTime() : null
      const duePassed = dueTs !== null && !Number.isNaN(dueTs) && dueTs < now

      for (const p of rows) {
        if (p.status === "not_started") notStarted += 1
        else if (p.status === "in_progress") inProgress += 1
        else if (p.status === "completed") completed += 1

        const done = isPlayerAssignmentComplete(assignmentType, {
          review_completed_at: p.review_completed_at,
          quiz_submitted_at: p.quiz_submitted_at,
        })
        if (!done && duePassed) overdue += 1

        if (p.score_percent !== null && p.score_percent !== undefined) {
          scoreSum += Number(p.score_percent)
          scoreN += 1
        }
      }

      const avgScore = scoreN > 0 ? Math.round((scoreSum / scoreN) * 100) / 100 : null

      return {
        ...a,
        counts: {
          notStarted,
          inProgress,
          completed,
          overdue,
          total: rows.length,
        },
        avgScore,
      }
    })

    return NextResponse.json({ assignments: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/**
 * POST — create assignment + items + optional quiz + per-player rows.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const auth = await requireTeamAccess(teamId)
    if (!canEditRoster(auth.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as {
      title?: string
      dueDate?: string | null
      assignedToType?: "team" | "side" | "position_group" | "players"
      assignedPositionGroup?: string | null
      assignedSide?: "offense" | "defense" | "special_teams" | null
      playerIds?: string[]
      assignmentType?: StudyAssignmentType
      publishStatus?: "draft" | "published"
      items?: { itemType: StudyItemType; itemId: string }[]
      questions?: DraftStudyQuestion[]
      reviewPlayerSummary?: string | null
    }

    if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })
    if (!body.assignedToType) return NextResponse.json({ error: "assignedToType required" }, { status: 400 })
    if (body.assignedToType === "side" && !body.assignedSide) {
      return NextResponse.json({ error: "assignedSide required for side targeting" }, { status: 400 })
    }
    if (body.assignedToType === "players" && (!Array.isArray(body.playerIds) || body.playerIds.length === 0)) {
      return NextResponse.json({ error: "playerIds required for player targeting" }, { status: 400 })
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "At least one content item required" }, { status: 400 })
    }

    const assignmentType: StudyAssignmentType =
      body.assignmentType === "quiz" || body.assignmentType === "mixed" || body.assignmentType === "review"
        ? body.assignmentType
        : "review"

    const questions = Array.isArray(body.questions) ? body.questions : []
    const needsQuiz = assignmentType === "quiz" || assignmentType === "mixed"
    if (needsQuiz && questions.length === 0) {
      return NextResponse.json({ error: "Questions required for quiz/mixed assignments" }, { status: 400 })
    }
    const qErr = needsQuiz && questions.length ? validateDraftQuestionsForSave(questions) : null
    if (qErr) return NextResponse.json({ error: qErr }, { status: 400 })

    const supabase = getSupabaseServer()

    const assignedSide =
      body.assignedToType === "side" ? (body.assignedSide as "offense" | "defense" | "special_teams") : null

    const playerIdsResolved = await resolveAssignmentPlayerIds(
      supabase,
      teamId,
      body.assignedToType,
      body.assignedPositionGroup ?? null,
      assignedSide,
      body.playerIds ?? null
    )

    const publishStatus = body.publishStatus === "draft" ? "draft" : "published"

    const reviewSummary =
      typeof body.reviewPlayerSummary === "string" && body.reviewPlayerSummary.trim()
        ? body.reviewPlayerSummary.trim()
        : null

    const { data: assignment, error: aErr } = await supabase
      .from("study_assignments")
      .insert({
        team_id: teamId,
        title: body.title.trim(),
        due_date: body.dueDate ? new Date(body.dueDate).toISOString() : null,
        assigned_to_type: body.assignedToType,
        assigned_position_group: body.assignedPositionGroup?.trim() || null,
        assigned_side: assignedSide,
        assignment_type: assignmentType,
        publish_status: publishStatus,
        assigned_player_ids:
          body.assignedToType === "players" && body.playerIds?.length ? body.playerIds : null,
        review_player_summary: reviewSummary,
        created_by: auth.user.id,
      })
      .select("*")
      .single()

    if (aErr || !assignment) {
      console.error(aErr)
      return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 })
    }

    const itemRows = body.items.map((it, i) => ({
      assignment_id: assignment.id,
      item_type: it.itemType,
      item_id: it.itemId,
      sort_order: i,
    }))

    const { error: iErr } = await supabase.from("study_assignment_items").insert(itemRows)
    if (iErr) {
      await supabase.from("study_assignments").delete().eq("id", assignment.id)
      return NextResponse.json({ error: "Failed to add items" }, { status: 500 })
    }

    if (publishStatus === "published") {
      if (playerIdsResolved.length === 0) {
        await supabase.from("study_assignments").delete().eq("id", assignment.id)
        return NextResponse.json(
          { error: "No roster players matched this assignment target. Check side filters or player selection." },
          { status: 400 }
        )
      }

      const pr = playerIdsResolved.map((player_id) => ({
        assignment_id: assignment.id,
        player_id,
        status: "not_started" as const,
      }))
      await supabase.from("study_assignment_players").insert(pr)
    }

    if (needsQuiz && questions.length > 0) {
      const { data: quiz, error: qzErr } = await supabase
        .from("mastery_quizzes")
        .insert({
          assignment_id: assignment.id,
          created_by: auth.user.id,
        })
        .select("id")
        .single()

      if (qzErr || !quiz) {
        console.error(qzErr)
        await supabase.from("study_assignments").delete().eq("id", assignment.id)
        return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 })
      }

      const qrows = questions.map((q, i) => ({
        quiz_id: quiz.id,
        question_text: q.questionText.trim(),
        question_type: q.questionType,
        options: q.options as object,
        correct_index: q.questionType === "matching" ? null : (q.correctIndex ?? 0),
        answer_key: q.questionType === "matching" ? q.answerKey : null,
        sort_order: i,
      }))

      const { error: mqErr } = await supabase.from("mastery_questions").insert(qrows)
      if (mqErr) {
        console.error(mqErr)
        await supabase.from("study_assignments").delete().eq("id", assignment.id)
        return NextResponse.json({ error: "Failed to add questions" }, { status: 500 })
      }
    }

    return NextResponse.json({ assignment })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    console.error("[study assignments POST]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
