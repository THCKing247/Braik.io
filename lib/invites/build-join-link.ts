import { resolveTrustedAppOrigin } from "@/lib/invites/resolve-invite-app-origin"

export type BuildPlayerJoinUrlResult =
  | { ok: true; url: string }
  | { ok: false; code: "APP_ORIGIN_INVALID" | "APP_ORIGIN_MISSING"; message: string }

function buildAbsoluteAppUrl(pathWithQuery: string, request?: Request): BuildPlayerJoinUrlResult {
  const originResult = resolveTrustedAppOrigin({ request })
  if (!originResult.ok) {
    return { ok: false, code: originResult.code, message: originResult.message }
  }
  return { ok: true, url: `${originResult.origin}${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}` }
}

/**
 * Player invite links (email, SMS, coach copy): land on the public player signup flow with the token.
 * `https://app.example/signup/player?token=...`
 */
export function buildPlayerInviteSignupUrl(token: string, request?: Request): BuildPlayerJoinUrlResult {
  const qs = new URLSearchParams({ token })
  return buildAbsoluteAppUrl(`/signup/player?${qs.toString()}`, request)
}

/**
 * Relative path + query for concatenating with a known origin (e.g. roster bootstrap).
 * `/signup/player?token=...`
 */
export function buildPlayerInviteSignupPath(token: string): string {
  const qs = new URLSearchParams({ token })
  return `/signup/player?${qs.toString()}`
}

/** Relative path for login `callbackUrl` — redeem invite after sign-in (`/join?token=...`). */
export function buildPlayerInviteRedeemPath(token: string): string {
  const qs = new URLSearchParams({ token })
  return `/join?${qs.toString()}`
}

/**
 * After sign-in, existing accounts redeem the invite here (links roster via POST /api/player-invites/redeem).
 * `https://app.example/join?token=...`
 */
export function buildPlayerInviteRedeemUrl(token: string, request?: Request): BuildPlayerJoinUrlResult {
  const qs = new URLSearchParams({ token })
  return buildAbsoluteAppUrl(`/join?${qs.toString()}`, request)
}

/**
 * Canonical player invite URL for emails and SMS — opens Join as Player with token (not generic login).
 * Same as {@link buildPlayerInviteSignupUrl}.
 */
export function buildPlayerJoinUrl(token: string, request?: Request): BuildPlayerJoinUrlResult {
  return buildPlayerInviteSignupUrl(token, request)
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
