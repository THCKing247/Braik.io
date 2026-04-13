export type StudyAssignmentType = "review" | "quiz" | "mixed"

export function isPlayerAssignmentComplete(
  assignmentType: StudyAssignmentType,
  row: { review_completed_at: string | null; quiz_submitted_at: string | null }
): boolean {
  if (assignmentType === "review") return Boolean(row.review_completed_at)
  if (assignmentType === "quiz") return Boolean(row.quiz_submitted_at)
  return Boolean(row.review_completed_at && row.quiz_submitted_at)
}

/** Lightweight review completion: opened material + cumulative dwell on assignment. */
export const REVIEW_DWELL_SECONDS_REQUIRED = 60

export function shouldAutoCompleteReview(row: {
  review_material_opened_at: string | null
  time_spent_seconds: number
}): boolean {
  return Boolean(row.review_material_opened_at && row.time_spent_seconds >= REVIEW_DWELL_SECONDS_REQUIRED)
}

export function playerFacingStatus(params: {
  assignmentType: StudyAssignmentType
  dueDate: string | null
  openedAt: string | null
  reviewCompletedAt: string | null
  quizSubmittedAt: string | null
  scorePercent: number | null
}): "Not Started" | "In Progress" | "Completed" | "Overdue" {
  const done = isPlayerAssignmentComplete(params.assignmentType, {
    review_completed_at: params.reviewCompletedAt,
    quiz_submitted_at: params.quizSubmittedAt,
  })
  if (done) return "Completed"
  const due = params.dueDate ? new Date(params.dueDate).getTime() : null
  if (due !== null && !Number.isNaN(due) && due < Date.now()) return "Overdue"
  if (!params.openedAt) return "Not Started"
  return "In Progress"
}
