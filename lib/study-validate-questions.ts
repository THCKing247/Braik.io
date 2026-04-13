import type { DraftStudyQuestion } from "@/lib/study-coach-b-quiz"

export function validateDraftQuestionsForSave(questions: DraftStudyQuestion[]): string | null {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!q.questionText?.trim()) return `Question ${i + 1}: missing text`
    if (q.questionType === "multiple_choice" || q.questionType === "true_false") {
      if (!Array.isArray(q.options) || q.options.length < 2) return `Question ${i + 1}: invalid options`
      if (q.correctIndex === null || q.correctIndex === undefined) return `Question ${i + 1}: missing correctIndex`
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) return `Question ${i + 1}: correctIndex out of range`
    }
    if (q.questionType === "matching") {
      if (!q.options || typeof q.options !== "object") return `Question ${i + 1}: matching options object required`
      const o = q.options as { left?: unknown; right?: unknown }
      if (!Array.isArray(o.left) || !Array.isArray(o.right) || o.left.length !== o.right.length) {
        return `Question ${i + 1}: matching left/right same length required`
      }
      if (!q.answerKey?.pairs?.length) return `Question ${i + 1}: matching answerKey.pairs required`
    }
  }
  return null
}
