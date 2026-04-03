import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { runCoachBChat } from "@/lib/braik-ai/coach-b-chat-handler"
import { isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import { parseCoachBVoiceRequest } from "@/lib/braik-ai/coach-b-voice-request"

export async function POST(req: Request) {
  if (!isOpenAIConfigured()) {
    console.error("[POST /api/ai/chat] OPENAI_API_KEY missing")
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
  }

  let body: {
    teamId?: string
    role?: string
    message?: string
    conversationHistory?: Array<{ role: string; content: string }>
    inputSource?: "text" | "voice"
    confirmProposalId?: string | null
    idempotencyKey?: string | null
    enableActionTools?: boolean
    coachVoice?: unknown
  }
  try {
    body = await req.json()
  } catch (e) {
    console.error("[POST /api/ai/chat] Invalid JSON")
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "message must be a non-empty string" }, { status: 400 })
  }

  const teamId = typeof body?.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : undefined
  const inputSource = body.inputSource === "voice" ? "voice" : "text"
  const enableActionTools = body.enableActionTools !== false
  const coachVoice = parseCoachBVoiceRequest(body.coachVoice)

  if (coachVoice?.voiceCommand) {
    console.log("[POST /api/ai/chat] voice command meta", {
      intentType: coachVoice.voiceCommand.intentType,
      actionName: coachVoice.voiceCommand.actionName ?? null,
      confidence: coachVoice.voiceCommand.confidence ?? null,
    })
  }

  const result = await runCoachBChat({
    message,
    teamId,
    sessionUser: session.user,
    conversationHistory: Array.isArray(body.conversationHistory) ? body.conversationHistory : [],
    inputSource,
    confirmProposalId: body.confirmProposalId ?? null,
    idempotencyKey: body.idempotencyKey ?? null,
    enableActionTools,
    incomingRequest: req,
    coachVoice: coachVoice ?? null,
  })

  if (result.type === "error") {
    return NextResponse.json({ error: result.message }, { status: result.status ?? 400 })
  }

  if (result.type === "action_proposal") {
    return NextResponse.json({
      type: "action_proposal",
      message: result.message,
      proposalId: result.proposalId,
      actionType: result.actionType,
      preview: result.preview,
      requiresApproval: true,
    })
  }

  if (result.type === "action_executed") {
    return NextResponse.json({
      type: "action_executed",
      response: result.response,
      result: result.result,
    })
  }

  return NextResponse.json({ response: result.response, type: "response" })
}
