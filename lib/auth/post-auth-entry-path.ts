import { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"

/** Post-login `/dashboard` bounce from middleware — not a deep link; prefer server portal entry. */
export function isGenericDashboardHome(path: string | null | undefined): boolean {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false
  const bare = path.split("?")[0]?.replace(/\/$/, "") ?? ""
  return bare === "/dashboard"
}

/** Organization / athletic department portal entry (varsity HC director access). */
export function isAdPortalEntryPath(path: string | null | undefined): boolean {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false
  const bare = path.split("?")[0] ?? path
  return bare.startsWith("/dashboard/ad") || bare.startsWith("/org/")
}

function isSafeInternalPath(p: string | null | undefined): p is string {
  return Boolean(p && p !== "/" && p.startsWith("/") && !p.startsWith("//"))
}

/**
 * Returns true when the callbackUrl targets a portal the authenticated role cannot access.
 *
 * Prevents cross-portal contamination such as a PLAYER being redirected into `/parent/…`
 * when the middleware set `callbackUrl=/parent/join` (e.g. via the /enter-player-code redirect).
 * When no role is provided the check is skipped (safe — role is always known after login).
 */
export function isCallbackUrlCrossPortal(
  callbackUrl: string,
  role: string | null | undefined
): boolean {
  if (!role) return false
  const r = role.toUpperCase().replace(/ /g, "_").replace(/-/g, "_")
  const isPlayer = r === "PLAYER" || r === "ATHLETE"
  const isParent = r === "PARENT"

  const cb = callbackUrl.toLowerCase().split("?")[0] ?? callbackUrl

  // Parent-only portal paths
  if (cb === "/parent" || cb.startsWith("/parent/")) return !isParent
  if (cb.startsWith("/dashboard/parent")) return !isParent

  // Player-only portal paths
  if (cb === "/player" || cb.startsWith("/player/")) return !isPlayer
  if (cb.startsWith("/dashboard/player")) return !isPlayer

  // Coach/staff-only paths that players and parents must not be sent into
  if (
    cb.startsWith("/dashboard/coach") ||
    cb.startsWith("/dashboard/org/") ||
    cb.startsWith("/dashboard/ad")
  ) {
    return isPlayer || isParent
  }

  return false
}

/**
 * Prefer server-resolved portal entry over generic `/dashboard` callbackUrl from middleware.
 * When `role` is provided, cross-portal callbackUrls are rejected in favour of `defaultAppPath`.
 */
export function resolvePostAuthDestination(opts: {
  callbackUrl?: string | null
  redirectTo?: string | null
  defaultAppPath?: string | null
  role?: string | null
}): string {
  const { callbackUrl, redirectTo, defaultAppPath, role } = opts
  if (
    callbackUrl &&
    isSafeInternalPath(callbackUrl) &&
    !isGenericDashboardHome(callbackUrl) &&
    !isCallbackUrlCrossPortal(callbackUrl, role)
  ) {
    return callbackUrl
  }
  if (isSafeInternalPath(redirectTo)) return redirectTo
  if (isSafeInternalPath(defaultAppPath)) return defaultAppPath
  // Final callbackUrl fallback only when role is absent (legacy callers without role context)
  if (callbackUrl && isSafeInternalPath(callbackUrl) && !isCallbackUrlCrossPortal(callbackUrl, role)) {
    return callbackUrl
  }
  return getDefaultAppPathForRole(role)
}

/** When merging session seeds, keep AD/org home over generic team dashboard fallback. */
export function pickPreferredDefaultAppPath(a?: string, b?: string): string | undefined {
  if (isAdPortalEntryPath(a)) return a
  if (isAdPortalEntryPath(b)) return b
  return a ?? b
}
