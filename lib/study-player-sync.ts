import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isPlayerAssignmentComplete,
  shouldAutoCompleteReview,
  type StudyAssignmentType,
} from "@/lib/study-assignment-logic"

/**
 * Re-reads the row and syncs aggregate `status`, optional auto review completion, and `completed_at`.
 * Call after mutating opened/material/dwell/quiz fields.
 */
export async function recomputeStudyPlayerRow(
  supabase: SupabaseClient,
  assignmentId: string,
  playerId: string
): Promise<void> {
  const { data: a } = await supabase
    .from("study_assignments")
    .select("assignment_type")
    .eq("id", assignmentId)
    .maybeSingle()

  const assignmentType = (a?.assignment_type ?? "review") as StudyAssignmentType

  const { data: row } = await supabase
    .from("study_assignment_players")
    .select(
      "opened_at, review_completed_at, quiz_submitted_at, completed_at, time_spent_seconds, review_material_opened_at"
    )
    .eq("assignment_id", assignmentId)
    .eq("player_id", playerId)
    .maybeSingle()

  if (!row) return

  let reviewCompletedAt = row.review_completed_at as string | null
  if (
    (assignmentType === "review" || assignmentType === "mixed") &&
    !reviewCompletedAt &&
    shouldAutoCompleteReview({
      review_material_opened_at: row.review_material_opened_at as string | null,
      time_spent_seconds: (row.time_spent_seconds as number) ?? 0,
    })
  ) {
    reviewCompletedAt = new Date().toISOString()
  }

  const done = isPlayerAssignmentComplete(assignmentType, {
    review_completed_at: reviewCompletedAt,
    quiz_submitted_at: row.quiz_submitted_at as string | null,
  })

  const opened = Boolean(row.opened_at)
  const status = !opened ? "not_started" : done ? "completed" : "in_progress"
  const completedAt =
    done && !row.completed_at ? new Date().toISOString() : (row.completed_at as string | null)

  await supabase
    .from("study_assignment_players")
    .update({
      review_completed_at: reviewCompletedAt,
      status,
      completed_at: completedAt,
    })
    .eq("assignment_id", assignmentId)
    .eq("player_id", playerId)
}
