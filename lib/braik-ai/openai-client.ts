import OpenAI from "openai"
import { APIConnectionTimeoutError, APIUserAbortError } from "openai/error"
import { toFile } from "openai/uploads"

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4"

/** Speech-to-text for Coach B voice capture (same API key as chat). Default whisper-1 is fast/reliable; override with OPENAI_TRANSCRIPTION_MODEL. */
export const OPENAI_TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1"

/** Stay under typical serverless ~30s limits with room for auth + parsing. */
export const OPENAI_TRANSCRIPTION_TIMEOUT_MS = Math.min(
  Math.max(parseInt(process.env.OPENAI_TRANSCRIPTION_TIMEOUT_MS || "22000", 10) || 22000, 5000),
  60000
)

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  if (client !== null) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) return null
  client = new OpenAI({ apiKey: apiKey.trim() })
  return client
}

/** Shared client for transcription, TTS, and chat completions with tools (same API key as Coach B). */
export function getOpenAIClient(): OpenAI | null {
  return getClient()
}

/**
 * Send the Coach B prompt to OpenAI and return the response text.
 * Uses responses.create with OPENAI_MODEL (default gpt-5.4). Throws on missing key or API failure.
 */
export async function sendCoachBPrompt(instructions: string, input: string | Array<{ role: "user" | "assistant" | "system" | "developer"; content: string; type?: "message" }>): Promise<string> {
  const c = getClient()
  if (!c) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  console.log("[OpenAI] Using model:", OPENAI_MODEL)
  const response = await c.responses.create({
    model: OPENAI_MODEL,
    instructions,
    input,
  })
  const text = typeof (response as { output_text?: string }).output_text === "string"
    ? (response as { output_text: string }).output_text
    : ""
  return text.trim() || "I couldn't generate a response. Please try again."
}

export function isOpenAIConfigured(): boolean {
  return getClient() !== null
}

export type TranscribeCoachBResult =
  | { transcript: string }
  | { error: string; code: "TRANSCRIPTION_FAILED" | "TRANSCRIPTION_TIMEOUT" | "OPENAI_NOT_CONFIGURED" }

/**
 * Transcribe raw audio bytes (e.g. webm from MediaRecorder). Does not run Coach B logic.
 * Uses a strict per-request timeout and no retries so the route returns before platform 504s.
 */
export async function transcribeCoachBAudio(params: {
  buffer: Buffer
  filename: string
}): Promise<TranscribeCoachBResult> {
  const c = getClient()
  if (!c) {
    return { error: "OPENAI_API_KEY is not configured", code: "OPENAI_NOT_CONFIGURED" }
  }
  const t0 = Date.now()
  const file = await toFile(params.buffer, params.filename)
  console.log("[OpenAI] Transcription request", {
    model: OPENAI_TRANSCRIPTION_MODEL,
    timeoutMs: OPENAI_TRANSCRIPTION_TIMEOUT_MS,
    maxRetries: 0,
    bytes: params.buffer.length,
    filename: params.filename,
  })
  try {
    const tr = await c.audio.transcriptions.create(
      {
        file,
        model: OPENAI_TRANSCRIPTION_MODEL,
      },
      { timeout: OPENAI_TRANSCRIPTION_TIMEOUT_MS, maxRetries: 0 }
    )
    const transcript = typeof tr.text === "string" ? tr.text.trim() : ""
    console.log("[OpenAI] Transcription complete", {
      ms: Date.now() - t0,
      charCount: transcript.length,
      model: OPENAI_TRANSCRIPTION_MODEL,
    })
    return { transcript }
  } catch (e) {
    if (e instanceof APIConnectionTimeoutError || e instanceof APIUserAbortError) {
      console.error("[OpenAI] Transcription timeout/abort", {
        ms: Date.now() - t0,
        name: e instanceof Error ? e.constructor.name : typeof e,
      })
      return { error: "Transcription timed out", code: "TRANSCRIPTION_TIMEOUT" }
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[OpenAI] Transcription failed", { ms: Date.now() - t0, message: msg })
    return { error: msg || "Transcription failed", code: "TRANSCRIPTION_FAILED" }
  }
}
