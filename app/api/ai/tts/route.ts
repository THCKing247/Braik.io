import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import { isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import { synthesizeCoachSpeech, COACH_B_TTS_MAX_INPUT_CHARS } from "@/lib/braik-ai/coach-b-tts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/ai/tts
 * Body: { text?: string, spokenSummary?: string, teamId?: string, voice?: string }
 * Returns raw audio (audio/mpeg). Use spokenSummary for concise playback when text is long.
 */
export async function POST(req: Request) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
  }

  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    text?: string
    spokenSummary?: string
    teamId?: string
    voice?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const fullText = typeof body.text === "string" ? body.text : ""
  const summary = typeof body.spokenSummary === "string" ? body.spokenSummary.trim() : ""
  /** Prefer explicit short summary for long replies; else full text (truncated server-side). */
  const speakSource = summary || fullText.trim()
  if (!speakSource) {
    return NextResponse.json({ error: "text or spokenSummary is required" }, { status: 400 })
  }

  const teamId = typeof body.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : ""
  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 })
  }
  try {
    const { membership } = await requireTeamAccess(teamId)
    if (!canUseCoachB(membership.role as Role)) {
      return NextResponse.json({ error: "Coach B is not available for this role." }, { status: 403 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: "You do not have access to this team." }, { status: 403 })
    }
    throw e
  }

  const speakText =
    speakSource.length > COACH_B_TTS_MAX_INPUT_CHARS
      ? `${speakSource.slice(0, COACH_B_TTS_MAX_INPUT_CHARS - 1)}…`
      : speakSource

  console.log("[POST /api/ai/tts]", {
    userId: session.user.id,
    teamId: teamId || null,
    usingSummary: Boolean(summary),
    charCount: speakText.length,
  })

  const result = await synthesizeCoachSpeech({
    text: speakText,
    voice: typeof body.voice === "string" ? body.voice : undefined,
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, no-store, max-age=0",
    },
  })
}
