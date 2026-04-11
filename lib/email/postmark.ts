/**
 * Postmark REST API — server-only transactional email.
 * @see https://postmarkapp.com/developer/api/email-api
 *
 * Env: POSTMARK_SERVER_TOKEN, POSTMARK_FROM_EMAIL (required to send).
 * Optional: POSTMARK_REPLY_TO_EMAIL, POSTMARK_MESSAGE_STREAM (default outbound).
 */

import {
  getPostmarkFromEmail,
  getPostmarkMessageStream,
  getPostmarkReplyToEmail,
  getPostmarkServerToken,
  isPostmarkConfigured,
  warnPostmarkMissingOnce,
} from "@/lib/email/postmark-config"

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export type EmailSendResult =
  | { ok: true; messageId: string }
  | {
      ok: false
      error: string
      status?: number
      errorCode?: number
    }

/** Legacy alias used by older call sites. */
export type PostmarkSendResult = EmailSendResult

export type SendEmailInput = {
  to: string
  subject: string
  /** If both omitted, send fails (Postmark requires at least one body). */
  htmlBody?: string
  textBody?: string
  cc?: string
  bcc?: string
  /** Overrides POSTMARK_FROM_EMAIL when set. */
  from?: string
  replyTo?: string
  tag?: string
  messageStream?: string
  /** Postmark Metadata — max 10 key/value pairs; values must be strings. */
  metadata?: Record<string, string>
}

function metadataToPostmarkArray(meta: Record<string, string> | undefined) {
  if (!meta || Object.keys(meta).length === 0) return undefined
  const entries = Object.entries(meta).slice(0, 10)
  return entries.map(([Name, Value]) => ({ Name, Value: String(Value).slice(0, 500) }))
}

function logPostmarkFailure(status: number, body: unknown, safeSummary: string) {
  const snippet =
    body && typeof body === "object" && "Message" in body
      ? String((body as { Message?: string }).Message ?? "")
      : ""
  const code =
    body && typeof body === "object" && "ErrorCode" in body
      ? Number((body as { ErrorCode?: number }).ErrorCode)
      : undefined
  console.error("[braik-email] Postmark request failed:", {
    status,
    errorCode: Number.isFinite(code) ? code : undefined,
    message: snippet || safeSummary,
  })
}

/**
 * Send a transactional email via Postmark `/email` endpoint.
 * Returns `{ ok: false }` when env is missing or the API errors — does not throw for HTTP errors.
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
  if (!isPostmarkConfigured()) {
    warnPostmarkMissingOnce("sendEmail")
    return {
      ok: false,
      error: "POSTMARK_SERVER_TOKEN is not configured or POSTMARK_FROM_EMAIL is missing",
    }
  }

  const token = getPostmarkServerToken()!
  const from = input.from?.trim() || getPostmarkFromEmail()!
  const html = input.htmlBody?.trim() ?? ""
  const text = input.textBody?.trim() ?? (html ? stripHtml(html) : "")

  if (!html && !text) {
    return { ok: false, error: "Email must include htmlBody and/or textBody" }
  }

  const replyTo = input.replyTo?.trim() || getPostmarkReplyToEmail()
  const stream = input.messageStream?.trim() || getPostmarkMessageStream()

  const payload: Record<string, unknown> = {
    From: from,
    To: input.to.trim(),
    Subject: input.subject.trim(),
    MessageStream: stream,
  }

  if (html) payload.HtmlBody = html
  if (text) payload.TextBody = text
  if (input.cc?.trim()) payload.Cc = input.cc.trim()
  if (input.bcc?.trim()) payload.Bcc = input.bcc.trim()
  if (replyTo) payload.ReplyTo = replyTo
  if (input.tag?.trim()) payload.Tag = input.tag.trim().slice(0, 100)

  const metaArr = metadataToPostmarkArray(input.metadata)
  if (metaArr) payload.Metadata = metaArr

  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify(payload),
    })

    const data = (await res.json().catch(() => ({}))) as {
      MessageID?: string
      Message?: string
      ErrorCode?: number
    }

    if (!res.ok) {
      logPostmarkFailure(res.status, data, res.statusText)
      return {
        ok: false,
        error: data.Message || res.statusText || "Postmark request failed",
        status: res.status,
        errorCode: typeof data.ErrorCode === "number" ? data.ErrorCode : undefined,
      }
    }

    return { ok: true, messageId: data.MessageID ?? "" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Postmark network error"
    console.error("[braik-email] Postmark fetch error:", msg)
    return { ok: false, error: msg }
  }
}

/**
 * HTML-first helper (existing roster email and similar).
 * Generates plain text from HTML when `textBody` is omitted.
 */
export async function sendPostmarkEmail(params: {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
  from?: string
  tag?: string
  metadata?: Record<string, string>
  messageStream?: string
}): Promise<PostmarkSendResult> {
  return sendEmail({
    to: params.to,
    subject: params.subject,
    htmlBody: params.htmlBody,
    textBody: params.textBody,
    from: params.from,
    tag: params.tag,
    metadata: params.metadata,
    messageStream: params.messageStream,
  })
}
