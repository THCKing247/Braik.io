/**
 * Canonical short IDs for org / team / player_account routes are unpadded decimal strings (`1`, `1245`).
 * Legacy URLs may use leading zeros (`001`, `001245`). These helpers normalize path segments only.
 */

/** If `seg` is all ASCII digits, return canonical form without leading zeros; otherwise `null` (caller keeps segment as-is). */
export function canonicalNumericRouteSegment(seg: string): string | null {
  const t = seg.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number.parseInt(t, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return String(n)
}

/**
 * Normalize path segments used as numeric ordinals or player account IDs (digits only → unpadded).
 * Non-numeric segments (e.g. future alphanumeric org keys) pass through unchanged.
 */
export function normalizeIncomingShortIdSegment(seg: string): string {
  const c = canonicalNumericRouteSegment(seg)
  return c ?? seg.trim()
}

/**
 * Redirect `/dashboard/org/001/team/002/roster/001245` → `/dashboard/org/1/team/2/roster/1245` when only padding differs.
 */
export function canonicalDashboardOrgTeamPathFromLegacyPadded(pathname: string): string | null {
  const bare = pathname.split("?")[0] ?? pathname
  const m = bare.match(/^\/dashboard\/org\/([^/]+)\/team\/([^/]+)(\/.*)?$/)
  if (!m) return null
  let org = decodeURIComponent(m[1] ?? "")
  let team = decodeURIComponent(m[2] ?? "")
  let tail = m[3] ?? ""
  let changed = false
  const co = canonicalNumericRouteSegment(org)
  if (co !== null && co !== org) {
    org = co
    changed = true
  }
  const ct = canonicalNumericRouteSegment(team)
  if (ct !== null && ct !== team) {
    team = ct
    changed = true
  }

  const rm = tail.match(/^\/roster\/([^/]+)(.*)?$/)
  if (rm) {
    let pseg = decodeURIComponent(rm[1] ?? "")
    const cp = canonicalNumericRouteSegment(pseg)
    if (cp !== null && cp !== pseg) {
      pseg = cp
      changed = true
      tail = `/roster/${encodeURIComponent(pseg)}${rm[2] ?? ""}`
    }
  }

  if (!changed) return null
  return `/dashboard/org/${encodeURIComponent(org)}/team/${encodeURIComponent(team)}${tail}`
}

/** Redirect `/org/001/teams` → `/org/1/teams`. */
export function canonicalOrgPortalPathFromLegacyPadded(pathname: string): string | null {
  const bare = pathname.split("?")[0] ?? pathname
  const m = bare.match(/^\/org\/([^/]+)(\/.*)?$/)
  if (!m) return null
  const raw = decodeURIComponent(m[1] ?? "")
  const c = canonicalNumericRouteSegment(raw)
  if (c === null || c === raw) return null
  return `/org/${encodeURIComponent(c)}${m[2] ?? ""}`
}
