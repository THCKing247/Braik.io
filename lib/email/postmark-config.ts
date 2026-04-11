/**
 * Server-only Postmark configuration from environment variables.
 * Never import this module from client components.
 *
 * Reads env at call time (request/runtime), not at module load, so values from
 * `.env.local` and host-injected vars work in API routes.
 */

let warnedMissingPostmark = false

export type PostmarkRequiredEnvKey = "POSTMARK_SERVER_TOKEN" | "POSTMARK_FROM_EMAIL"

export type PostmarkConfigStatus = {
  configured: boolean
  /** Whether a non-empty server token is present (never the secret value). */
  hasServerToken: boolean
  /** Verified sender when set — safe to expose to authenticated coaches in status API. */
  fromEmail: string | null
  replyToEmail: string | null
  supportEmail: string | null
  messageStream: string
  /** Which required vars are missing (empty when configured). */
  missing: PostmarkRequiredEnvKey[]
  /**
   * User-facing explanation when `configured` is false.
   * `POSTMARK_FROM_EMAIL` must be a verified sender or domain in Postmark.
   */
  userMessage: string
}

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

/** @deprecated Prefer {@link getPostmarkConfigStatus} for UI and diagnostics. */
export function isPostmarkConfigured(): boolean {
  return getPostmarkConfigStatus().configured
}

/**
 * Single source of truth for Postmark readiness (server-side).
 * Call from API routes / server actions — reads `process.env` at runtime.
 */
export function getPostmarkConfigStatus(): PostmarkConfigStatus {
  const hasServerToken = Boolean(getPostmarkServerToken())
  const fromEmail = getPostmarkFromEmail() ?? null
  const missing: PostmarkRequiredEnvKey[] = []
  if (!hasServerToken) missing.push("POSTMARK_SERVER_TOKEN")
  if (!fromEmail) missing.push("POSTMARK_FROM_EMAIL")

  const configured = missing.length === 0
  const userMessage = configured
    ? ""
    : "Postmark is not configured. Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL on the server, and make sure the sender is verified in Postmark."

  return {
    configured,
    hasServerToken,
    fromEmail,
    replyToEmail: getPostmarkReplyToEmail() ?? null,
    supportEmail: getPostmarkSupportEmail() ?? null,
    messageStream: getPostmarkMessageStream(),
    missing,
    userMessage,
  }
}

/** One-time warning in production when email is requested but Postmark env is incomplete. */
export function warnPostmarkMissingOnce(context: string) {
  if (warnedMissingPostmark) return
  if (process.env.NODE_ENV !== "production") return
  warnedMissingPostmark = true
  const status = getPostmarkConfigStatus()
  console.warn(`[braik-email] Postmark not fully configured (${context}).`, {
    hasServerToken: status.hasServerToken,
    hasFromEmail: Boolean(status.fromEmail),
    missing: status.missing,
  })
}
