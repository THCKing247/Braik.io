import type { SupabaseClient } from "@supabase/supabase-js"
import { sendCoachBPrompt, isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import type { EffectiveVideoEntitlements } from "@/lib/video/entitlements"

export type AiClipAssistInput = {
  notesOrTranscript: string
  existingTitle?: string | null
  /** Human-readable timing line for naming context (coach notes + clock), not vision. */
  clipTimingSummary?: string | null
}

export type AiSuggestedCategories = {
  playType?: string
  situation?: string
  personnel?: string
  outcome?: string
}

export type AiClipAssistSuccess = {
  suggestedTitle: string
  suggestedDescription: string
  suggestedTags: string[]
  suggestedCategories: AiSuggestedCategories
}

export type AiClipAssistResult =
  | ({ ok: true } & AiClipAssistSuccess)
  | { ok: false; code: "OPENAI_NOT_CONFIGURED" | "EMPTY_INPUT" | "AI_DISABLED"; message: string }

/**
 * Text-only assist — uses coach notes, optional transcript snippets, and timing summary.
 * Does not analyze pixels; future transcript/OCR/play-recognition can feed the same interface.
 */
export async function suggestClipMetadataFromText(
  entitlements: EffectiveVideoEntitlements,
  input: AiClipAssistInput
): Promise<AiClipAssistResult> {
  if (!entitlements.aiVideoFeaturesEnabled) {
    return { ok: false, code: "AI_DISABLED", message: "AI video features are not enabled for this team." }
  }
  const raw = input.notesOrTranscript?.trim() ?? ""
  if (raw.length < 3) {
    return { ok: false, code: "EMPTY_INPUT", message: "Provide notes or transcript text to analyze." }
  }
  if (!isOpenAIConfigured()) {
    return { ok: false, code: "OPENAI_NOT_CONFIGURED", message: "AI assistant is not configured." }
  }

  const timingBlock = input.clipTimingSummary?.trim()
    ? `Clip timing context (from editor clocks, not auto-detected): ${input.clipTimingSummary.trim()}`
    : ""

  const prompt = [
    "You help football coaches label short game clips for film breakdown.",
    "Return STRICT JSON only with keys:",
    "- suggestedTitle (string, under 80 chars)",
    "- suggestedDescription (string, 1-3 sentences)",
    "- suggestedTags (array of 3-10 short lowercase tags, kebab or single words)",
    "- suggestedCategories (object with optional string fields: playType, situation, personnel, outcome — use empty string or omit if unknown)",
    "Infer categories only from the text provided, not from video.",
    input.existingTitle ? `Existing title hint: ${input.existingTitle}` : "",
    timingBlock,
    "Source notes / transcript:",
    raw.slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const text = await sendCoachBPrompt(
      "You output only valid JSON for coaching clip labels. No markdown fences.",
      prompt
    )
    let parsed: {
      suggestedTitle?: string
      suggestedDescription?: string
      suggestedTags?: string[]
      suggestedCategories?: Partial<AiSuggestedCategories>
    }
    try {
      parsed = JSON.parse(text) as typeof parsed
    } catch {
      return { ok: false, code: "OPENAI_NOT_CONFIGURED", message: "Could not parse AI response." }
    }
    const suggestedTitle = String(parsed.suggestedTitle ?? "").trim().slice(0, 200)
    const suggestedDescription = String(parsed.suggestedDescription ?? "").trim().slice(0, 2000)
    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.map((t) => String(t).trim()).filter(Boolean).slice(0, 14)
      : []
    const c = parsed.suggestedCategories ?? {}
    const suggestedCategories: AiSuggestedCategories = {
      playType: c.playType ? String(c.playType).trim().slice(0, 80) : undefined,
      situation: c.situation ? String(c.situation).trim().slice(0, 80) : undefined,
      personnel: c.personnel ? String(c.personnel).trim().slice(0, 80) : undefined,
      outcome: c.outcome ? String(c.outcome).trim().slice(0, 80) : undefined,
    }
    return {
      ok: true,
      suggestedTitle: suggestedTitle || "Untitled clip",
      suggestedDescription,
      suggestedTags,
      suggestedCategories,
    }
  } catch {
    return {
      ok: false,
      code: "OPENAI_NOT_CONFIGURED",
      message: "Could not generate suggestions. Try again.",
    }
  }
}

export async function insertAiJobCompleted(
  supabase: SupabaseClient,
  row: {
    teamId: string
    gameVideoId?: string | null
    videoClipId?: string | null
    jobType: string
    input: Record<string, unknown>
    output: Record<string, unknown>
  }
): Promise<void> {
  await supabase.from("video_ai_jobs").insert({
    team_id: row.teamId,
    game_video_id: row.gameVideoId ?? null,
    video_clip_id: row.videoClipId ?? null,
    job_type: row.jobType,
    status: "completed",
    provider: "openai",
    input: row.input,
    output: row.output,
    updated_at: new Date().toISOString(),
  })
}
