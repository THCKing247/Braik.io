import { normalizePlayerJoinCode } from "@/lib/players/join-code-normalize"
import { normalizePlayerInviteCode } from "@/lib/parent-player-code"

/**
 * Canonical public site URL for share links and QR codes (no trailing slash).
 * Prefer `NEXT_PUBLIC_APP_URL` when set so QR codes point at production, not a dev origin.
 */
export function getPublicSiteUrl(): string {
  const env = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") : ""
  if (env) return env
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

export function buildPlayerSignupUrl(playerCode: string): string {
  const base = getPublicSiteUrl()
  const code = encodeURIComponent(normalizePlayerJoinCode(playerCode))
  return `${base}/signup/player?code=${code}`
}

/** Opens Join as player with the personal player invite code prefilled (not the shared team code). */
export function buildPlayerInviteCodeSignupUrl(inviteCode: string): string {
  const base = getPublicSiteUrl()
  const code = encodeURIComponent(normalizePlayerInviteCode(inviteCode))
  return `${base}/signup/player?playerCode=${code}`
}
