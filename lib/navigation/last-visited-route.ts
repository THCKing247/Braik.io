import { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"

const STORAGE_KEY = "braik_last_app_path"
const MAX_LEN = 512

/** Paths we persist for “resume where you left off” after mobile root redirect. */
function isStorableAppPath(path: string): boolean {
  if (!path.startsWith("/") || path.length > MAX_LEN) return false
  if (path.startsWith("/dashboard")) return true
  if (path.startsWith("/admin") && path !== "/admin/login") return true
  return false
}

export function saveLastVisitedAppPath(pathname: string): void {
  if (typeof window === "undefined") return
  const normalized = pathname.split("?")[0] ?? pathname
  if (!isStorableAppPath(normalized)) return
  try {
    window.localStorage.setItem(STORAGE_KEY, normalized)
  } catch {
    // ignore quota / private mode
  }
}

export function readLastVisitedAppPath(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw || !isStorableAppPath(raw)) return null
    return raw
  } catch {
    return null
  }
}

/** Last visited dashboard/admin path, or role default (for post-login / mobile `/` redirect). */
export function getResumeOrDefaultAppPath(role?: string | null): string {
  const stored = readLastVisitedAppPath()
  if (stored) return stored
  return getDefaultAppPathForRole(role)
}
