import type { SupabaseClient } from "@supabase/supabase-js"
import { sendCoachBPrompt, isOpenAIConfigured } from "@/lib/braik-ai/openai-client"
import type { EffectiveVideoEntitlements } from "@/lib/video/entitlements"

export type AiClipAssistInput = {
  notesOrTranscript: string
  /** Optional existing title hint */
  existingTitle?: string | null
}

export type AiClipAssistResult =
  | { ok: true; suggestedTitle: string; suggestedDescription: string; suggestedTags: string[] }
  | { ok: false; code: "OPENAI_NOT_CONFIGURED" | "EMPTY_INPUT" | "AI_DISABLED"; message: string }

/**
 * Lightweight text-only assist — uses coach notes / transcript snippets, not pixel-level video understanding.
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

  const prompt = [
    "You help football coaches label short game clips.",
    "Return STRICT JSON only with keys: suggestedTitle (string), suggestedDescription (string), suggestedTags (array of 3-8 short lowercase slug-like tags, no spaces).",
    "Titles should be concise (under 80 characters). Descriptions should be 1-3 sentences.",
    input.existingTitle ? `Existing title hint: ${input.existingTitle}` : "",
    "Source text:",
    raw.slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const text = await sendCoachBPrompt(
      "You output only valid JSON objects for coaching clip labels. No markdown fences.",
      prompt
    )
    let parsed: {
      suggestedTitle?: string
      suggestedDescription?: string
      suggestedTags?: string[]
    }
    try {
      parsed = JSON.parse(text) as typeof parsed
    } catch {
      return { ok: false, code: "OPENAI_NOT_CONFIGURED", message: "Could not parse AI response." }
    }
    const suggestedTitle = String(parsed.suggestedTitle ?? "").trim().slice(0, 200)
    const suggestedDescription = String(parsed.suggestedDescription ?? "").trim().slice(0, 2000)
    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
      : []
    return {
      ok: true,
      suggestedTitle: suggestedTitle || "Untitled clip",
      suggestedDescription,
      suggestedTags,
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
