/**
 * Postmark REST API — server-only transactional email.
 * @see https://postmarkapp.com/developer/api/email-api
 *
 * Env: POSTMARK_SERVER_TOKEN, POSTMARK_FROM_EMAIL (required to send).
 * Optional: POSTMARK_REPLY_TO_EMAIL, POSTMARK_MESSAGE_STREAM (default outbound).
 */

import {
  getPostmarkConfigStatus,
  getPostmarkFromEmail,
  getPostmarkMessageStream,
  getPostmarkReplyToEmail,
  getPostmarkServerToken,
  warnPostmarkMissingOnce,
} from "@/lib/email/postmark-config"
import { sanitizePostmarkMetadata } from "@/lib/email/postmark-metadata"

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export type EmailSendErrorCode =
  | "POSTMARK_NOT_CONFIGURED"
  | "INVALID_BODY"
  | "POSTMARK_API_ERROR"
  | "NETWORK"

export type EmailSendResult =
  | { ok: true; messageId: string }
  | {
      ok: false
      error: string
      code?: EmailSendErrorCode
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
  /** Passed through {@link sanitizePostmarkMetadata} — flat object, max 10 keys, Postmark limits apply. */
  metadata?: Record<string, unknown>
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

const POSTMARK_NOT_CONFIGURED_MESSAGE =
  "Postmark is not configured. Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL, and make sure the sender is verified in Postmark."

/**
 * Send a transactional email via Postmark `/email` endpoint.
 * Returns `{ ok: false }` when env is missing or the API errors — does not throw for HTTP errors.
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const cfg = getPostmarkConfigStatus()
  if (!cfg.configured) {
    warnPostmarkMissingOnce("sendEmail")
    console.info("[braik-email] sendEmail skipped — not configured", {
      hasServerToken: cfg.hasServerToken,
      fromEmail: cfg.fromEmail,
      missing: cfg.missing,
    })
    return {
      ok: false,
      code: "POSTMARK_NOT_CONFIGURED",
      error: cfg.userMessage || POSTMARK_NOT_CONFIGURED_MESSAGE,
    }
  }

  const token = getPostmarkServerToken()!
  const from = input.from?.trim() || getPostmarkFromEmail()!
  const html = input.htmlBody?.trim() ?? ""
  const text = input.textBody?.trim() ?? (html ? stripHtml(html) : "")

  if (!html && !text) {
    return { ok: false, code: "INVALID_BODY", error: "Email must include htmlBody and/or textBody" }
  }

  const replyTo = input.replyTo?.trim() || getPostmarkReplyToEmail()
  const stream = input.messageStream?.trim() || getPostmarkMessageStream()

  const sanitizedMeta = sanitizePostmarkMetadata(input.metadata)
  console.info("[braik-email] sendEmail", {
    hasServerToken: true,
    fromEmail: from,
    messageStream: stream,
    tag: input.tag?.trim() || null,
    hasMetadata: Boolean(sanitizedMeta),
    metadataKeys: sanitizedMeta ? Object.keys(sanitizedMeta) : [],
  })

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

  if (sanitizedMeta && Object.keys(sanitizedMeta).length > 0) {
    payload.Metadata = sanitizedMeta
  }

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
        code: "POSTMARK_API_ERROR",
        error: data.Message || res.statusText || "Postmark request failed",
        status: res.status,
        errorCode: typeof data.ErrorCode === "number" ? data.ErrorCode : undefined,
      }
    }

    console.info("[braik-email] Postmark send ok", {
      messageIdPresent: Boolean(data.MessageID),
      status: res.status,
    })

    return { ok: true, messageId: data.MessageID ?? "" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Postmark network error"
    console.error("[braik-email] Postmark fetch error:", msg)
    return { ok: false, code: "NETWORK", error: msg }
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
  cc?: string
  from?: string
  tag?: string
  metadata?: Record<string, unknown>
  messageStream?: string
}): Promise<PostmarkSendResult> {
  return sendEmail({
    to: params.to,
    subject: params.subject,
    htmlBody: params.htmlBody,
    textBody: params.textBody,
    cc: params.cc,
    from: params.from,
    tag: params.tag,
    metadata: params.metadata,
    messageStream: params.messageStream,
  })
}
