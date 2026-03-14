import OpenAI from "openai"
import { NextResponse } from "next/server"
import { getTeamContext, detectQuestionType } from "@/lib/ai/coach-b-context"

const apiKey = process.env.OPENAI_API_KEY
const client = apiKey ? new OpenAI({ apiKey }) : null

const COACH_B_SYSTEM_BASE = `You are Coach B, Braik's football coaching assistant. Use Braik software data first when available. Do not ask the coach for information that already exists in the provided context. If key information is missing from the software data, say exactly what is missing. Be concise, practical, and focused on football. Do not propose or execute actions outside of conversation—only answer questions and give coaching advice.`

export async function POST(req: Request) {
  if (!client) {
    console.error("[POST /api/ai/chat] OPENAI_API_KEY is missing")
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    )
  }

  let body: {
    teamId?: string
    role?: string
    message?: string
    conversationHistory?: Array<{ role: string; content: string }>
  }

  try {
    body = await req.json()
  } catch (e) {
    console.error("[POST /api/ai/chat] Invalid JSON body", e)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }

  const message =
    typeof body?.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json(
      { error: "message must be a non-empty string" },
      { status: 400 }
    )
  }

  const teamId =
    typeof body?.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : undefined

  // Fetch Braik team context when teamId is provided; fall back gracefully on failure
  let instructions = COACH_B_SYSTEM_BASE
  if (teamId) {
    const questionType = detectQuestionType(message)
    console.log("[POST /api/ai/chat] teamId provided, fetching context", {
      teamId,
      questionType,
    })
    try {
      const teamContext = await getTeamContext(teamId, message)
      if (teamContext) {
        instructions =
          COACH_B_SYSTEM_BASE +
          "\n\n" +
          teamContext.braikContextBlock
        console.log("[POST /api/ai/chat] Braik team context found", {
          playerCount: teamContext.playerCount,
          qbCount: teamContext.qbCount,
          depthChartEntryCount: teamContext.depthChartEntryCount,
          upcomingEventCount: teamContext.upcomingEventCount,
          upcomingGameCount: teamContext.upcomingGameCount,
          activeInjuryCount: teamContext.activeInjuryCount,
        })
      } else {
        console.log("[POST /api/ai/chat] Braik team context not available, using generic behavior")
      }
    } catch (contextErr) {
      console.error("[POST /api/ai/chat] Team context fetch failed, falling back to generic", {
        teamId,
        error: contextErr,
      })
      // instructions stay as COACH_B_SYSTEM_BASE only
    }
  } else {
    console.log("[POST /api/ai/chat] No teamId provided, using generic behavior")
  }

  const history = Array.isArray(body.conversationHistory)
    ? body.conversationHistory
    : []

  const conversationMessages: Array<{ role: "user" | "assistant" | "system" | "developer"; content: string; type?: "message" }> = []
  for (const h of history) {
    const role = h?.role === "assistant" ? "assistant" : "user"
    const content = typeof h?.content === "string" ? h.content : ""
    if (content) {
      conversationMessages.push({ role, content, type: "message" })
    }
  }
  conversationMessages.push({ role: "user", content: message, type: "message" })

  const input =
    conversationMessages.length <= 1
      ? message
      : conversationMessages.map((m) => ({
          role: m.role,
          content: m.content,
          type: "message" as const,
        }))

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions,
      input,
    })

    const text =
      typeof (response as { output_text?: string }).output_text === "string"
        ? (response as { output_text: string }).output_text
        : ""

    return NextResponse.json({
      response: text || "I couldn't generate a response. Please try again.",
      type: "response",
    })
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/ai/chat] OpenAI request failed", err)
    return NextResponse.json(
      {
        error: "AI chat failed",
        details,
      },
      { status: 500 }
    )
  }
}
