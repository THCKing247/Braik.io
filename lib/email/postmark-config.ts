/**
 * Server-only Postmark configuration from environment variables.
 * Never import this module from client components.
 */

let warnedMissingPostmark = false

export function getPostmarkMessageStream(): string {
  const s = process.env.POSTMARK_MESSAGE_STREAM?.trim()
  return s && s.length > 0 ? s : "outbound"
}

export function getPostmarkFromEmail(): string | undefined {
  const v = process.env.POSTMARK_FROM_EMAIL?.trim()
  return v && v.length > 0 ? v : undefined
}

export function getPostmarkReplyToEmail(): string | undefined {
  const v = process.env.POSTMARK_REPLY_TO_EMAIL?.trim()
  return v && v.length > 0 ? v : undefined
}

export function getPostmarkSupportEmail(): string | undefined {
  const v = process.env.POSTMARK_SUPPORT_EMAIL?.trim()
  return v && v.length > 0 ? v : undefined
}

export function getPostmarkServerToken(): string | undefined {
  const v = process.env.POSTMARK_SERVER_TOKEN?.trim()
  return v && v.length > 0 ? v : undefined
}

export function isPostmarkConfigured(): boolean {
  return Boolean(getPostmarkServerToken() && getPostmarkFromEmail())
}

/** One-time warning in production when email is requested but Postmark env is incomplete. */
export function warnPostmarkMissingOnce(context: string) {
  if (warnedMissingPostmark) return
  if (process.env.NODE_ENV !== "production") return
  warnedMissingPostmark = true
  console.warn(
    `[braik-email] Postmark is not fully configured (${context}). Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL on the server.`
  )
}
