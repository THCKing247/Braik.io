import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import { isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import { synthesizeCoachSpeech, COACH_B_TTS_MAX_INPUT_CHARS } from "@/lib/braik-ai/coach-b-tts"
import { resolveVoiceModeFromInput, type VoiceContext } from "@/lib/braik-ai/resolve-voice-mode"
import { buildCoachBTtsInstructions } from "@/lib/config/voice-modes"
import { VOICE_CONFIG } from "@/lib/config/voice"
import { parseCoachBVoiceRequest } from "@/lib/braik-ai/coach-b-voice-request"
import { resolveCoachBVoiceProfile } from "@/lib/braik-ai/resolve-coach-b-voice-profile"
import { COACH_B_PLUS_UNAVAILABLE_USER_MESSAGE, isCoachBPlusEntitled } from "@/lib/braik-ai/coach-b-plus-entitlement"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseVoiceContext(raw: unknown): VoiceContext | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const page = typeof o.page === "string" ? o.page.trim().slice(0, 128) : undefined
  const action = typeof o.action === "string" ? o.action.trim().slice(0, 128) : undefined
  const intent = typeof o.intent === "string" ? o.intent.trim().slice(0, 128) : undefined
  if (!page && !action && !intent) return undefined
  return { ...(page ? { page } : {}), ...(action ? { action } : {}), ...(intent ? { intent } : {}) }
}

/**
 * POST /api/ai/tts
 * Body: { text?, spokenSummary?, teamId?, context?: { page?, action?, intent? }, coachVoice?: { ... } }
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
    context?: unknown
    coachVoice?: unknown
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

  const supabase = getSupabaseServer()
  const coachBPlus = await isCoachBPlusEntitled(supabase, teamId, session.user.id, {
    isPlatformOwner: session.user.isPlatformOwner === true,
  })
  if (!coachBPlus) {
    return NextResponse.json(
      { error: COACH_B_PLUS_UNAVAILABLE_USER_MESSAGE, code: "coach_b_plus_required" },
      { status: 403 }
    )
  }

  const speakText =
    speakSource.length > COACH_B_TTS_MAX_INPUT_CHARS
      ? `${speakSource.slice(0, COACH_B_TTS_MAX_INPUT_CHARS - 1)}…`
      : speakSource

  const voiceCtx = parseVoiceContext(body.context)
  const cv = parseCoachBVoiceRequest(body.coachVoice)
  const mode = resolveVoiceModeFromInput({
    page: cv?.page ?? voiceCtx?.page,
    action: cv?.action ?? voiceCtx?.action,
    intent: cv?.intent ?? voiceCtx?.intent,
    isLiveGame: cv?.isLiveGame,
    isPractice: cv?.isPractice,
    isMessaging: cv?.isMessaging,
    isSidelineModeEnabled: cv?.sidelineMode,
    manualModeOverride: cv?.voiceModeOverride ?? null,
  })

  const profile = resolveCoachBVoiceProfile({
    userPreferences: cv?.userVoiceMemory ?? null,
    teamPreferences: cv?.teamVoiceMemory ?? null,
    selectedPersonality: cv?.personalityId ?? null,
    personalityOverride: cv?.personalityOverride ?? null,
    selectedMode: mode,
    currentContext: {
      page: cv?.page ?? voiceCtx?.page,
      action: cv?.action ?? voiceCtx?.action,
      intent: cv?.intent ?? voiceCtx?.intent,
      isMessagingSurface: cv?.isMessaging,
      isOffensePlayQuestion:
        cv?.voiceCommand?.intentType === "recommendation" ||
        cv?.intent === "game_strategy" ||
        cv?.page === "playbooks",
    },
  })

  const instructions = buildCoachBTtsInstructions({
    profile: {
      effectiveMode: profile.effectiveMode,
      toneInstructions: profile.toneInstructions,
    },
  })

  const modelUsed = process.env.OPENAI_TTS_MODEL ?? VOICE_CONFIG.model
  console.log("[POST /api/ai/tts]", {
    event: "coach_b_tts_generation",
    userId: session.user.id,
    teamId,
    model: modelUsed,
    voice: VOICE_CONFIG.voice,
    voiceMode: mode,
    personality: profile.personality,
    sidelineMode: Boolean(cv?.sidelineMode),
    voiceContext: voiceCtx ?? null,
    usingSummary: Boolean(summary),
    charCount: speakText.length,
    instructionsChars: instructions.length,
  })

  const result = await synthesizeCoachSpeech({
    text: speakText,
    instructions,
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
