import { NextResponse } from "next/server"
import { buildContext } from "@/lib/braik-ai/context-builder"
import { buildCoachBPrompt, createGenericContext } from "@/lib/braik-ai/prompt-builder"
import { sendCoachBPrompt, isOpenAIConfigured } from "@/lib/braik-ai/openai-client"

export async function POST(req: Request) {
  if (!isOpenAIConfigured()) {
    console.error("[POST /api/ai/chat] OPENAI_API_KEY missing")
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    )
  }

  let body: { teamId?: string; role?: string; message?: string; conversationHistory?: Array<{ role: string; content: string }> }
  try {
    body = await req.json()
  } catch (e) {
    console.error("[POST /api/ai/chat] Invalid JSON")
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "message must be a non-empty string" }, { status: 400 })
  }

  const teamId = typeof body?.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : undefined
  const history = Array.isArray(body.conversationHistory) ? body.conversationHistory : []

  let context = createGenericContext()
  if (teamId) {
    try {
      const result = await buildContext(teamId, message)
      if (result) {
        context = result.context
        console.log("[POST /api/ai/chat]", {
          domain: result.summary.domain,
          intent: result.summary.intent,
          rosterCount: result.summary.rosterCount,
          playbookCount: result.summary.playbookCount,
          playCount: result.summary.playCount,
          injuryCount: result.summary.injuryCount,
          scheduleCount: result.summary.scheduleCount,
          namedPlayersMatched: result.summary.namedPlayersMatched,
          positionsMatched: result.summary.positionsMatched,
        })
      } else {
        context = createGenericContext(["Braik context could not be loaded."])
        console.log("[POST /api/ai/chat] context unavailable, generic mode")
      }
    } catch (err) {
      console.error("[POST /api/ai/chat] context build failed", err)
      context = createGenericContext(["Context build failed; answering from general knowledge."])
    }
  } else {
    console.log("[POST /api/ai/chat] no teamId, generic mode")
  }

  const prompt = buildCoachBPrompt({ context, message, history })
  if (process.env.BRAIK_AI_DEBUG === "1") {
    console.log("[Coach B debug] route: using context domain=%s hasTeam=%s", context.domain, context.team != null)
  }

  try {
    const text = await sendCoachBPrompt(prompt.instructions, prompt.input)
    return NextResponse.json({ response: text, type: "response" })
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/ai/chat] OpenAI failed", details)
    return NextResponse.json({ error: "AI chat failed", details }, { status: 500 })
  }
}
