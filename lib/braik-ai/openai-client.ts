import OpenAI from "openai"
import { toFile } from "openai/uploads"

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4"

/** Speech-to-text for Coach B voice capture (same API key as chat). */
export const OPENAI_TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-transcribe"

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

/**
 * Transcribe raw audio bytes (e.g. webm from MediaRecorder). Does not run Coach B logic.
 */
export async function transcribeCoachBAudio(params: {
  buffer: Buffer
  filename: string
}): Promise<{ transcript: string } | { error: string }> {
  const c = getClient()
  if (!c) {
    return { error: "OPENAI_API_KEY is not configured" }
  }
  const file = await toFile(params.buffer, params.filename)
  console.log("[OpenAI] Transcription model:", OPENAI_TRANSCRIPTION_MODEL)
  try {
    const tr = await c.audio.transcriptions.create({
      file,
      model: OPENAI_TRANSCRIPTION_MODEL,
    })
    const transcript = typeof tr.text === "string" ? tr.text.trim() : ""
    return { transcript }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[OpenAI] Transcription failed", msg)
    return { error: "Transcription failed" }
  }
}
