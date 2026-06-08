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
 * Prefer server-resolved portal entry over generic `/dashboard` callbackUrl from middleware.
 */
export function resolvePostAuthDestination(opts: {
  callbackUrl?: string | null
  redirectTo?: string | null
  defaultAppPath?: string | null
  role?: string | null
}): string {
  const { callbackUrl, redirectTo, defaultAppPath, role } = opts
  if (callbackUrl && isSafeInternalPath(callbackUrl) && !isGenericDashboardHome(callbackUrl)) {
    return callbackUrl
  }
  if (isSafeInternalPath(redirectTo)) return redirectTo
  if (isSafeInternalPath(defaultAppPath)) return defaultAppPath
  if (callbackUrl && isSafeInternalPath(callbackUrl)) return callbackUrl
  return getDefaultAppPathForRole(role)
}

/** When merging session seeds, keep AD/org home over generic team dashboard fallback. */
export function pickPreferredDefaultAppPath(a?: string, b?: string): string | undefined {
  if (isAdPortalEntryPath(a)) return a
  if (isAdPortalEntryPath(b)) return b
  return a ?? b
}
