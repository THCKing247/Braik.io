/**
 * @deprecated Import from `@/lib/email/postmark` or `@/lib/email/braik-emails` instead.
 * Thin adapter for legacy call sites — maps to unified {@link sendEmail}.
 */

import { sendEmail, type EmailSendResult } from "@/lib/email/postmark"

export interface SendEmailOptions {
  to: string
  subject: string
  textBody: string
  htmlBody?: string
  tag?: string
  metadata?: Record<string, string>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

function mapResult(r: EmailSendResult): SendEmailResult {
  if (r.ok) {
    return { success: true, messageId: r.messageId }
  }
  return { success: false, error: r.error }
}

/** @deprecated Use sendPlayerInviteEmail from @/lib/email/braik-emails */
export async function sendEmailViaPostmark(options: SendEmailOptions): Promise<SendEmailResult> {
  const r = await sendEmail({
    to: options.to,
    subject: options.subject,
    textBody: options.textBody,
    htmlBody: options.htmlBody,
    tag: options.tag,
    metadata: options.metadata,
  })
  return mapResult(r)
}
