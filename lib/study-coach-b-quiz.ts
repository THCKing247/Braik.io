import type { StudyAssignmentType } from "@/lib/study-assignment-logic"
import type { StudyQuestionType } from "@/lib/study-quiz-utils"

export type DraftStudyQuestion = {
  questionText: string
  questionType: StudyQuestionType
  options: unknown
  correctIndex?: number | null
  answerKey?: { pairs: [number, number][] } | null
}

export function buildQuizGenerationUserMessage(params: {
  programContext: string
  coachObjective: string
  assignmentType: StudyAssignmentType
  questionTypes: StudyQuestionType[]
  maxQuestions: number
}): string {
  const qt = params.questionTypes.join(", ")
  return `You are Coach B helping build a football study quiz strictly from the PROGRAM CONTEXT below. Do not invent plays or terminology not implied by the context.

PROGRAM CONTEXT:
${params.programContext}

Assignment style: ${assignmentStyleLabel(params.assignmentType)}
Coach objective: ${params.coachObjective.trim()}

Generate up to ${params.maxQuestions} questions. Allowed question types only: ${qt}.
Rules:
- multiple_choice: options must be a JSON array of 3-5 strings; include exactly one correct answer; set correctIndex to the 0-based index of the correct option.
- true_false: options must be ["True","False"]; correctIndex 0 or 1.
- matching: options must be {"left":["..."],"right":["..."]} with same length; set answerKey.pairs as array of [leftIndex, rightIndex] for each correct pair (1:1 matching).

Return ONLY a JSON array (no markdown fences) of objects with shape:
[{"questionText":"...","questionType":"multiple_choice|true_false|matching","options":...,"correctIndex":number|null,"answerKey":{"pairs":[[0,0]]}|null}]
`
}

function assignmentStyleLabel(t: StudyAssignmentType): string {
  if (t === "mixed") return "mixed (material + quiz)"
  return t
}

export function parseDraftQuestionsFromModelText(raw: string): DraftStudyQuestion[] {
  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf("[")
  const jsonEnd = trimmed.lastIndexOf("]")
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return []
  const slice = trimmed.slice(jsonStart, jsonEnd + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(slice) as unknown
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: DraftStudyQuestion[] = []
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const questionText = typeof r.questionText === "string" ? r.questionText.trim() : ""
    const questionType = r.questionType as StudyQuestionType
    if (!questionText) continue
    if (questionType !== "multiple_choice" && questionType !== "true_false" && questionType !== "matching") continue
    const options = r.options
    let correctIndex: number | null =
      typeof r.correctIndex === "number" && Number.isInteger(r.correctIndex) ? r.correctIndex : null
    let answerKey: { pairs: [number, number][] } | null = null
    if (r.answerKey && typeof r.answerKey === "object" && Array.isArray((r.answerKey as { pairs?: unknown }).pairs)) {
      const pairs = (r.answerKey as { pairs: unknown[] }).pairs
        .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number")
        .map((p) => [p[0], p[1]] as [number, number])
      if (pairs.length) answerKey = { pairs }
    }
    if (questionType === "matching" && (!answerKey || !options || typeof options !== "object")) continue
    if ((questionType === "multiple_choice" || questionType === "true_false") && correctIndex === null) continue
    out.push({
      questionText,
      questionType,
      options,
      correctIndex,
      answerKey,
    })
  }
  return out
}
