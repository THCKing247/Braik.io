import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"
import { freePortalRestPath, parseFreePortalPath } from "@/lib/portal/free-portal-path-utils"
import { stripDashboardPortalPrefix } from "@/lib/portal/dashboard-path"

/**
 * Normalized `/dashboard/...` paths (no portal prefix) that non-coach portals must not access.
 * Uses path prefix checks after stripping `/dashboard`.
 */
const PLAYER_FORBIDDEN_REST = [
  "/settings",
  "/admin",
  "/invites",
  "/weight-room",
  "/inventory",
  "/stats",
  "/fundraising",
  "/health",
  "/program-intelligence",
  "/director",
  "/collections",
  "/invoice",
  "/recruiting",
  "/roster/review",
  "/ai-assistant",
] as const

const PARENT_FORBIDDEN_REST = [
  "/settings",
  "/admin",
  "/invites",
  "/weight-room",
  "/inventory",
  "/stats",
  "/fundraising",
  "/health",
  "/program-intelligence",
  "/director",
  "/collections",
  "/invoice",
  "/recruiting",
  "/roster/review",
  "/playbooks",
  "/ai-assistant",
] as const

const RECRUITER_ALLOWED_REST_PREFIXES = [
  "/recruiting",
  "/messages",
  "/profile",
  "/support",
] as const

function restPath(normalizedDashboardPath: string): string {
  const p = normalizedDashboardPath.replace(/\/$/, "") || "/dashboard"
  if (p === "/dashboard") return ""
  return p.slice("/dashboard".length) || ""
}

/**
 * Inner route tail (after `/dashboard` or free-portal segment) forbidden for player/parent/recruiter.
 */
export function isPortalRestForbiddenForNonCoach(kind: BraikPortalKind, rest: string): boolean {
  if (kind === "coach") return false

  if (kind === "recruiter") {
    if (rest === "" || rest === "/") return true
    return !RECRUITER_ALLOWED_REST_PREFIXES.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`))
  }

  const forbidden = kind === "parent" ? PARENT_FORBIDDEN_REST : PLAYER_FORBIDDEN_REST
  return forbidden.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`))
}

/** `/player/:id` and `/parent/:code` — same RBAC tails as prefixed `/dashboard/player` routes. */
export function isFreePortalPathForbiddenForPortal(kind: BraikPortalKind, pathname: string): boolean {
  const parsed = parseFreePortalPath(pathname.split("?")[0] ?? pathname)
  if (!parsed) return false
  if (parsed.portal === "player" && kind !== "player") return true
  if (parsed.portal === "parent" && kind !== "parent") return true
  const rest = freePortalRestPath(parsed)
  return isPortalRestForbiddenForNonCoach(kind, rest)
}

/** Returns true when the pathname should be blocked for this portal kind (404-style redirect to home). */
export function isDashboardPathForbiddenForPortal(kind: BraikPortalKind, pathname: string): boolean {
  const bare = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "") || "/"

  if (kind === "coach") return false

  /** Player/parent portals are not part of the coach org/team dashboard tree — block the entire `/dashboard` space. */
  if (kind === "player" || kind === "parent") {
    return bare === "/dashboard" || bare.startsWith("/dashboard/")
  }

  const normalized = stripDashboardPortalPrefix(pathname.split("?")[0] ?? pathname)
  const rest = restPath(normalized)
  return isPortalRestForbiddenForNonCoach(kind, rest)
}

export function forbiddenRestListForPortalKind(kind: BraikPortalKind): readonly string[] {
  if (kind === "player") return PLAYER_FORBIDDEN_REST
  if (kind === "parent") return PARENT_FORBIDDEN_REST
  return []
}
