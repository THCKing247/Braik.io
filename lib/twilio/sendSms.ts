/**
 * Reusable Twilio SMS sender for Braik. Server-side only (API routes / server code).
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

import twilio from "twilio"

const ENV_ACCOUNT_SID = "TWILIO_ACCOUNT_SID"
const ENV_AUTH_TOKEN = "TWILIO_AUTH_TOKEN"
const ENV_FROM = "TWILIO_PHONE_NUMBER"

function getTwilioEnv(): { accountSid: string; authToken: string; from: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()

  const missing: string[] = []
  if (!accountSid?.trim()) missing.push(ENV_ACCOUNT_SID)
  if (!authToken?.trim()) missing.push(ENV_AUTH_TOKEN)
  if (!from) missing.push(ENV_FROM)

  if (missing.length > 0) {
    throw new Error(`Twilio config missing: ${missing.join(", ")}. Set these in Netlify env.`)
  }

  return { accountSid: accountSid!.trim(), authToken: authToken!.trim(), from: from! }
}

export interface SendSmsResult {
  sid: string
  status?: string
}

/**
 * Send an SMS via Twilio. Uses TWILIO_PHONE_NUMBER as sender.
 * @throws Error if env vars are missing
 */
export async function sendSMS(to: string, body: string): Promise<SendSmsResult> {
  const { accountSid, authToken, from } = getTwilioEnv()

  const toTrimmed = to.trim()
  if (!toTrimmed) {
    throw new Error("sendSMS: 'to' must be a non-empty phone number.")
  }

  const client = twilio(accountSid, authToken)

  try {
    const message = await client.messages.create({
      to: toTrimmed,
      from,
      body,
    })
    return { sid: message.sid, status: message.status ?? undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Twilio request failed"
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: number }).code : undefined
    const toMask = toTrimmed.length >= 6 ? `${toTrimmed.slice(0, 6)}***` : "***"
    console.error("[Twilio sendSMS] failed", { to: toMask, code, message: msg })
    throw err
  }
}
