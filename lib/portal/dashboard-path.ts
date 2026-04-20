import {
  buildDashboardTeamPath,
  type DashboardTeamPathParams,
} from "@/lib/navigation/organization-routes"
import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"

/** First URL segment after `/dashboard` for role-specific namespaces (rewritten to legacy `/dashboard/*`). */
export const PORTAL_URL_SEGMENT: Record<BraikPortalKind, string> = {
  coach: "coach",
  player: "player",
  parent: "parent",
  recruiter: "recruiter",
}

export type TeamRouteShortIds = Pick<DashboardTeamPathParams, "shortOrgId" | "shortTeamId">

/**
 * Strip canonical org/team dashboard prefix and `/dashboard/{coach|player|parent|recruiter}` so policy
 * checks + active-nav matching align with legacy `/dashboard/...` paths from `quickActions`.
 */
export function stripDashboardPortalPrefix(pathname: string): string {
  let p = pathname.split("?")[0] ?? pathname

  const canon = p.match(/^\/dashboard\/org\/[^/]+\/team\/[^/]+(\/.*)?$/)
  if (canon) {
    const tail = canon[1] ?? ""
    return tail ? `/dashboard${tail}` : "/dashboard"
  }

  // Canonical recruiter workspace URL aliases to `/dashboard/recruiting` routes.
  if (p === "/dashboard/recruiter" || p.startsWith("/dashboard/recruiter/")) {
    p = p.replace(/^\/dashboard\/recruiter/, "/dashboard/recruiting")
  }
  for (const seg of Object.values(PORTAL_URL_SEGMENT)) {
    const prefix = `/dashboard/${seg}`
    if (p === prefix || p === `${prefix}/`) return "/dashboard"
    if (p.startsWith(`${prefix}/`)) return `/dashboard${p.slice(prefix.length)}`
  }
  return p
}

/**
 * Coach team dashboard: canonical `/dashboard/org/:shortOrgId/team/:shortTeamId/...` when short IDs exist;
 * otherwise legacy `/dashboard/coach/...`. Other portal kinds keep prefixed URLs.
 */
export function teamScopedDashboardHref(
  kind: BraikPortalKind,
  rest: string,
  shortIds: TeamRouteShortIds | null | undefined
): string {
  const normalizedRest =
    rest === "" || rest === "/" ? "/" : rest.startsWith("/") ? rest : `/${rest}`
  const nested =
    normalizedRest === "/" ? undefined : normalizedRest
  if (kind === "coach" && shortIds?.shortOrgId && shortIds?.shortTeamId) {
    return buildDashboardTeamPath(
      { shortOrgId: shortIds.shortOrgId, shortTeamId: shortIds.shortTeamId },
      nested
    )
  }
  return portalPrefixedDashboardHref(kind, normalizedRest)
}

/**
 * Build a canonical dashboard href under the user's portal prefix (pretty URL in the address bar).
 * `rest` is `/roster`, `/calendar`, or `/` for home.
 */
export function portalPrefixedDashboardHref(kind: BraikPortalKind, rest: string): string {
  const segment = PORTAL_URL_SEGMENT[kind]
  const r = rest.startsWith("/") ? rest : `/${rest}`
  if (r === "/" || r === "") return `/dashboard/${segment}`
  return `/dashboard/${segment}${r}`
}

/** Default landing path per portal (after auth when no callback / last-visited). */
export function defaultDashboardEntryForPortal(kind: BraikPortalKind): string {
  switch (kind) {
    case "player":
      return portalPrefixedDashboardHref("player", "/")
    case "parent":
      return portalPrefixedDashboardHref("parent", "/")
    case "recruiter":
      // Canonical alias for authenticated recruiter workspace (rewrite → /dashboard/recruiting).
      return "/dashboard/recruiter"
    case "coach":
    default:
      return portalPrefixedDashboardHref("coach", "/")
  }
}
