/**
 * Postmark email sending for Braik player invites.
 * Env: POSTMARK_SERVER_TOKEN, POSTMARK_FROM_EMAIL
 */

export interface SendEmailOptions {
  to: string
  subject: string
  textBody: string
  htmlBody?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendEmailViaPostmark(options: SendEmailOptions): Promise<SendEmailResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN
  const from = process.env.POSTMARK_FROM_EMAIL
  if (!token || !from?.trim()) {
    return { success: false, error: "Postmark not configured (POSTMARK_SERVER_TOKEN or POSTMARK_FROM_EMAIL missing)." }
  }

  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify({
        From: from.trim(),
        To: options.to.trim(),
        Subject: options.subject,
        TextBody: options.textBody,
        ...(options.htmlBody ? { HtmlBody: options.htmlBody } : {}),
      }),
    })

    const data = (await res.json().catch(() => ({}))) as { MessageID?: string; Message?: string; ErrorCode?: number } | undefined
    if (!res.ok) {
      const msg = (data && "Message" in data ? data.Message : res.statusText) || "Postmark send failed"
      return { success: false, error: msg }
    }
    return { success: true, messageId: data?.MessageID }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Postmark request failed"
    return { success: false, error: msg }
  }
}
