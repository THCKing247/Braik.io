import { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"

function isSafeInternalPath(p: string | null | undefined): p is string {
  /** Bare `/` is the marketing hero — never treat it as a post-auth app destination. */
  return Boolean(p && p !== "/" && p.startsWith("/") && !p.startsWith("//"))
}

/**
 * After signup-secure (or credential sign-in fallback), choose where to navigate client-side.
 * Prefer server-computed `redirectTo` / `user.defaultAppPath`, then refresh from GET /api/auth/session.
 */
export async function resolveClientPostAuthDestination(
  data: { redirectTo?: string; user?: { defaultAppPath?: string } | null },
  options: { profileRole?: string | null } = {}
): Promise<string> {
  if (isSafeInternalPath(data.redirectTo)) return data.redirectTo
  if (isSafeInternalPath(data.user?.defaultAppPath)) return data.user.defaultAppPath

  try {
    const r = await fetch("/api/auth/session", { credentials: "include" })
    if (r.ok) {
      const j = (await r.json().catch(() => ({}))) as { user?: { defaultAppPath?: string } | null }
      if (isSafeInternalPath(j.user?.defaultAppPath)) return j.user.defaultAppPath
    }
  } catch {
    /* ignore */
  }

  return getDefaultAppPathForRole(options.profileRole)
}
