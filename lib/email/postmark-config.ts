/**
 * Server-only Postmark configuration from environment variables.
 * Never import this module from client components.
 *
 * Reads env at call time (request/runtime), not at module load, so values from
 * `.env.local` and host-injected vars work in API routes.
 */

let warnedMissingPostmark = false

/** Verified sender in Postmark should match this domain (see apextsgroup.com DNS / Postmark). */
export const DEFAULT_POSTMARK_FROM_EMAIL = "Braik <noreply@apextsgroup.com>"

export type PostmarkRequiredEnvKey = "POSTMARK_SERVER_TOKEN" | "POSTMARK_FROM_EMAIL"

export type PostmarkConfigStatus = {
  configured: boolean
  /** Whether a non-empty server token is present (never the secret value). */
  hasServerToken: boolean
  /** Resolved From address (env or default) — safe to expose to authenticated coaches in status API. */
  fromEmail: string
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

/**
 * Resolved From address for Postmark. Uses `POSTMARK_FROM_EMAIL` when set, except legacy
 * `@braik.io` values are replaced so sending matches the apextsgroup.com verified sender.
 */
export function getPostmarkFromEmail(): string {
  const raw = process.env.POSTMARK_FROM_EMAIL?.trim()
  if (!raw) return DEFAULT_POSTMARK_FROM_EMAIL
  if (/@braik\.io\b/i.test(raw)) return DEFAULT_POSTMARK_FROM_EMAIL
  return raw
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
  const fromEmail = getPostmarkFromEmail()
  const missing: PostmarkRequiredEnvKey[] = []
  if (!hasServerToken) missing.push("POSTMARK_SERVER_TOKEN")

  /** Token is required; From falls back to {@link DEFAULT_POSTMARK_FROM_EMAIL} when unset. */
  const configured = hasServerToken
  const userMessage = configured
    ? ""
    : "Postmark is not configured. Set POSTMARK_SERVER_TOKEN on the server. Optionally set POSTMARK_FROM_EMAIL (defaults to noreply@apextsgroup.com); verify the sender domain in Postmark."

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
