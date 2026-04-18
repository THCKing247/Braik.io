import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"

/** First URL segment after `/dashboard` for role-specific namespaces (rewritten to legacy `/dashboard/*`). */
export const PORTAL_URL_SEGMENT: Record<BraikPortalKind, string> = {
  coach: "coach",
  player: "player",
  parent: "parent",
  recruiter: "recruiter",
}

/**
 * Strip `/dashboard/{coach|player|parent|recruiter}` so policy checks match legacy `/dashboard/...` routes.
 */
export function stripDashboardPortalPrefix(pathname: string): string {
  let p = pathname.split("?")[0] ?? pathname
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
