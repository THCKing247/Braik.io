/**
 * Twilio SMS sending for Braik player invites.
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */

export interface SendSmsOptions {
  to: string
  body: string
}

export interface SendSmsResult {
  success: boolean
  sid?: string
  error?: string
}

export async function sendSmsViaTwilio(options: SendSmsOptions): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  if (!accountSid || !authToken || !from?.trim()) {
    return { success: false, error: "Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER missing)." }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const body = new URLSearchParams()
  body.set("To", options.to.trim())
  body.set("From", from.trim())
  body.set("Body", options.body)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      },
      body: body.toString(),
    })

    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number } | undefined
    if (!res.ok) {
      const msg = (data && "message" in data ? data.message : res.statusText) || "Twilio send failed"
      return { success: false, error: msg }
    }
    return { success: true, sid: data?.sid }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Twilio request failed"
    return { success: false, error: msg }
  }
}
