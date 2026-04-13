import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { sendCoachBPrompt, isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import { buildStudySourceContextString, type StudyItemType } from "@/lib/study-source-context"
import { buildQuizGenerationUserMessage, parseDraftQuestionsFromModelText } from "@/lib/study-coach-b-quiz"
import type { StudyAssignmentType } from "@/lib/study-assignment-logic"
import type { StudyQuestionType } from "@/lib/study-quiz-utils"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

const INSTRUCTIONS =
  "You are Coach B. When the user asks for quiz JSON, respond with ONLY a single JSON array — no markdown, no commentary."

const allowedItemTypes: StudyItemType[] = ["playbook", "formation", "play", "install_script", "study_pack"]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    if (!isOpenAIConfigured()) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
    }

    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const auth = await requireTeamAccess(teamId)
    if (!canEditRoster(auth.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as {
      sources?: { itemType: string; itemId: string }[]
      coachObjective?: string
      assignmentType?: StudyAssignmentType
      questionTypes?: StudyQuestionType[]
      maxQuestions?: number
    }

    if (!Array.isArray(body.sources) || body.sources.length === 0) {
      return NextResponse.json({ error: "sources required" }, { status: 400 })
    }
    const objective = typeof body.coachObjective === "string" ? body.coachObjective.trim() : ""
    if (!objective) return NextResponse.json({ error: "coachObjective required" }, { status: 400 })

    const assignmentType: StudyAssignmentType =
      body.assignmentType === "quiz" || body.assignmentType === "mixed" || body.assignmentType === "review"
        ? body.assignmentType
        : "mixed"

    const allowedTypes: StudyQuestionType[] = ["multiple_choice", "true_false", "matching"]
    const questionTypes = Array.isArray(body.questionTypes)
      ? body.questionTypes.filter((t): t is StudyQuestionType => allowedTypes.includes(t as StudyQuestionType))
      : (["multiple_choice", "true_false"] as StudyQuestionType[])
    if (questionTypes.length === 0) {
      return NextResponse.json({ error: "questionTypes invalid" }, { status: 400 })
    }

    const maxQuestions = Math.min(20, Math.max(1, Number(body.maxQuestions) || 8))

    const itemTypeOk = new Set<string>(allowedItemTypes)
    const sources = body.sources
      .map((s) => ({
        itemType: s.itemType as StudyItemType,
        itemId: typeof s.itemId === "string" ? s.itemId : "",
      }))
      .filter((s) => Boolean(s.itemId) && itemTypeOk.has(s.itemType))

    if (sources.length === 0) return NextResponse.json({ error: "No valid sources" }, { status: 400 })

    const supabase = getSupabaseServer()
    const programContext = await buildStudySourceContextString(supabase, teamId, sources)
    if (!programContext.trim()) {
      return NextResponse.json({ error: "Could not load program context for selected items" }, { status: 400 })
    }

    const userMsg = buildQuizGenerationUserMessage({
      programContext,
      coachObjective: objective,
      assignmentType,
      questionTypes,
      maxQuestions,
    })

    const raw = await sendCoachBPrompt(INSTRUCTIONS, userMsg)
    const questions = parseDraftQuestionsFromModelText(raw)

    return NextResponse.json({ questions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    console.error("[study generate-quiz]", e)
    return NextResponse.json({ error: "Generation failed" }, { status: 500 })
  }
}
