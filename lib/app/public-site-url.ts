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
  const code = encodeURIComponent(playerCode.trim().toUpperCase())
  return `${base}/signup/player?code=${code}`
}
