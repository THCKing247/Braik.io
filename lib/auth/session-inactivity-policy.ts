/**
 * Portal inactivity logout aligns with non-remember-me access token lifetime (1 hour).
 * @see lib/auth/build-password-session-success.ts
 */
export const BRAIK_PORTAL_SESSION_IDLE_MS = 60 * 60 * 1000

/** Warning modal countdown before automatic sign-out. */
export const BRAIK_PORTAL_SESSION_WARNING_MS = 2 * 60 * 1000

/** Idle time before the warning modal appears (58 minutes). */
export const BRAIK_PORTAL_SESSION_IDLE_BEFORE_WARNING_MS =
  BRAIK_PORTAL_SESSION_IDLE_MS - BRAIK_PORTAL_SESSION_WARNING_MS

/** Refresh httpOnly cookies while the user is active (before the 1h access cookie expires). */
export const BRAIK_PORTAL_SESSION_KEEPALIVE_MS = 45 * 60 * 1000

const PORTAL_PREFIXES = ["/dashboard", "/admin", "/org", "/player", "/parent"] as const

export function isPortalAuthenticatedPath(pathname: string): boolean {
  if (pathname === "/admin/login") return false
  return PORTAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
