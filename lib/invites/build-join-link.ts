import { resolveTrustedAppOrigin } from "@/lib/invites/resolve-invite-app-origin"

export type BuildPlayerJoinUrlResult =
  | { ok: true; url: string }
  | { ok: false; code: "APP_ORIGIN_INVALID" | "APP_ORIGIN_MISSING"; message: string }

/**
 * Absolute join URL: `https://app.example/join?token=...`
 * Use for emails, SMS, and API responses. Never returns a relative URL.
 */
export function buildPlayerJoinUrl(token: string, request?: Request): BuildPlayerJoinUrlResult {
  const originResult = resolveTrustedAppOrigin({ request })
  if (!originResult.ok) {
    return { ok: false, code: originResult.code, message: originResult.message }
  }
  const path = "/join"
  const qs = new URLSearchParams({ token })
  return { ok: true, url: `${originResult.origin}${path}?${qs.toString()}` }
}

/**
 * @deprecated Prefer {@link buildPlayerJoinUrl} — this only returned a relative URL when env was missing (broken in emails).
 * Kept for any legacy imports; delegates to {@link buildPlayerJoinUrl}.
 */
export function buildJoinLink(token: string, request?: Request): string {
  const r = buildPlayerJoinUrl(token, request)
  if (r.ok) return r.url
  return ""
}
