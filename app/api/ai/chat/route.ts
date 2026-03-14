import OpenAI from "openai"
import { NextResponse } from "next/server"

const apiKey = process.env.OPENAI_API_KEY
const client = apiKey ? new OpenAI({ apiKey }) : null

const COACH_B_SYSTEM_PROMPT = `You are Coach B, the football coaching assistant for Braik. You help coaches with strategy, play calling, practice planning, roster decisions, and team management. Be concise, practical, and focused on football. Use the coach's team context when relevant (e.g., teamId, role) to tailor advice. Do not propose or execute actions outside of conversation—only answer questions and give coaching advice.`

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
      instructions: COACH_B_SYSTEM_PROMPT,
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
