export type StudyQuestionType = "multiple_choice" | "true_false" | "matching"

export type QuizQuestionForGrading = {
  id: string
  question_text?: string
  question_type: StudyQuestionType
  correct_index: number | null
  answer_key: { pairs: [number, number][] } | null
  options: unknown
}

export type QuizAnswerPayload =
  | { questionId: string; selectedIndex: number }
  | { questionId: string; pairs: [number, number][] }

function matchingPairsFromOptions(options: unknown): { left: string[]; right: string[] } | null {
  if (!options || typeof options !== "object") return null
  const o = options as { left?: unknown; right?: unknown }
  if (!Array.isArray(o.left) || !Array.isArray(o.right)) return null
  const left = o.left.filter((x): x is string => typeof x === "string")
  const right = o.right.filter((x): x is string => typeof x === "string")
  if (left.length === 0 || right.length === 0) return null
  return { left, right }
}

export function gradeQuestion(q: QuizQuestionForGrading, answer: QuizAnswerPayload | undefined): boolean {
  if (!answer || answer.questionId !== q.id) return false
  if (q.question_type === "multiple_choice" || q.question_type === "true_false") {
    if (!("selectedIndex" in answer)) return false
    if (q.correct_index === null || q.correct_index === undefined) return false
    return answer.selectedIndex === q.correct_index
  }
  if (q.question_type === "matching") {
    if (!("pairs" in answer) || !Array.isArray(answer.pairs)) return false
    const expected = q.answer_key?.pairs
    if (!expected?.length) return false
    if (answer.pairs.length !== expected.length) return false
    const norm = (p: [number, number]) => `${p[0]}:${p[1]}`
    const aSet = new Set(answer.pairs.map((p) => norm(p)))
    const eSet = new Set(expected.map((p) => norm(p as [number, number])))
    if (aSet.size !== eSet.size) return false
    for (const x of eSet) {
      if (!aSet.has(x)) return false
    }
    return true
  }
  return false
}

export function gradeSubmission(
  questions: QuizQuestionForGrading[],
  answers: QuizAnswerPayload[]
): { correct: number; total: number; scorePercent: number } {
  const byId = new Map(answers.map((a) => [a.questionId, a]))
  let correct = 0
  const total = questions.length
  for (const q of questions) {
    if (gradeQuestion(q, byId.get(q.id))) correct += 1
  }
  const scorePercent = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0
  return { correct, total, scorePercent }
}

/** Player-safe question shape (no correct answers). Order matches grading indices. */
export function sanitizeQuestionForPlayer(q: QuizQuestionForGrading): {
  id: string
  question_type: StudyQuestionType
  question_text: string
  options: unknown
} {
  if (q.question_type === "matching") {
    const m = matchingPairsFromOptions(q.options)
    return {
      id: q.id,
      question_type: "matching",
      question_text: (q as { question_text?: string }).question_text ?? "",
      options: m ?? { left: [], right: [] },
    }
  }
  const opts = q.options
  return {
    id: q.id,
    question_type: q.question_type,
    question_text: (q as { question_text?: string }).question_text ?? "",
    options: Array.isArray(opts) ? opts : opts,
  }
}
