/**
 * Coach B text-to-speech (OpenAI audio.speech). Kept separate from chat completions for swapping providers/voices later.
 */

import { getOpenAIClient } from "@/lib/braik-ai/openai-client"
import {
  COACH_B_TTS_INSTRUCTIONS,
  VOICE_CONFIG,
} from "@/lib/config/voice"

/** OpenAI TTS max input length */
export const COACH_B_TTS_MAX_INPUT_CHARS = 4096

export type CoachBVoiceId =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "sage"
  | "shimmer"
  | "verse"

export async function synthesizeCoachSpeech(params: {
  text: string
  /** Defaults to VOICE_CONFIG + COACH_B_TTS_INSTRUCTIONS; override only for tests or future providers. */
  voice?: string
  model?: string
  instructions?: string
}): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  const client = getOpenAIClient()
  if (!client) {
    return { error: "OPENAI_API_KEY is not configured" }
  }
  const input = params.text.trim().slice(0, COACH_B_TTS_MAX_INPUT_CHARS)
  if (!input) {
    return { error: "No text to speak" }
  }
  const voice = (params.voice ?? VOICE_CONFIG.voice) as CoachBVoiceId
  const model = params.model ?? process.env.OPENAI_TTS_MODEL ?? VOICE_CONFIG.model
  const instructions = params.instructions ?? COACH_B_TTS_INSTRUCTIONS

  console.log("[Coach B TTS] synthesize", {
    model,
    voice,
    charCount: input.length,
    instructionsChars: instructions.length,
  })

  try {
    const speech = await client.audio.speech.create({
      model,
      voice,
      input,
      instructions,
    })
    const ab = await speech.arrayBuffer()
    const buffer = Buffer.from(ab)
    return { buffer, contentType: "audio/mpeg" }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[Coach B TTS] OpenAI speech failed", msg)
    return { error: "Text-to-speech failed" }
  }
}
