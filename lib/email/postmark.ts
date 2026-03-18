/**
 * Postmark transactional email. Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL (verified sender).
 * @see https://postmarkapp.com/developer/api/email-api
 */

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export type PostmarkSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; status?: number }

export async function sendPostmarkEmail(params: {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
  /** Optional override; defaults to POSTMARK_FROM_EMAIL */
  from?: string
}): Promise<PostmarkSendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim()
  if (!token) {
    return { ok: false, error: "POSTMARK_SERVER_TOKEN is not configured" }
  }
  const from = params.from?.trim() || process.env.POSTMARK_FROM_EMAIL?.trim()
  if (!from) {
    return { ok: false, error: "POSTMARK_FROM_EMAIL is not configured" }
  }

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: params.to.trim(),
      Subject: params.subject,
      HtmlBody: params.htmlBody,
      TextBody: params.textBody ?? stripHtml(params.htmlBody),
      MessageStream: "outbound",
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    MessageID?: string
    Message?: string
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data.Message || res.statusText || "Postmark request failed",
      status: res.status,
    }
  }

  return { ok: true, messageId: data.MessageID ?? "" }
}
