import OpenAI from "openai"

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  if (client !== null) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) return null
  client = new OpenAI({ apiKey: apiKey.trim() })
  return client
}

/**
 * Send the Coach B prompt to OpenAI and return the response text.
 * Uses responses.create with gpt-4.1-mini. Throws on missing key or API failure.
 */
export async function sendCoachBPrompt(instructions: string, input: string | Array<{ role: "user" | "assistant" | "system" | "developer"; content: string; type?: "message" }>): Promise<string> {
  const c = getClient()
  if (!c) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  const response = await c.responses.create({
    model: "gpt-4.1-mini",
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
