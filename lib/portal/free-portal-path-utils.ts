/**
 * Standalone player/parent portals live outside `/dashboard` — `/player/:accountId`, `/parent/:linkCode`.
 * Segment is the public roster key (numeric `player_account_id`) for routing; parents use the same segment
 * for the primary linked player context until a dedicated invite-code column exists.
 */

export type FreePortalParse =
  | { portal: "player"; segment: string; rest: string }
  | { portal: "parent"; segment: string; rest: string }

export function parseFreePortalPath(pathname: string): FreePortalParse | null {
  const p = pathname.split("?")[0] ?? pathname
  const player = p.match(/^\/player\/([^/]+)(\/.*)?$/)
  if (player) {
    try {
      return {
        portal: "player",
        segment: decodeURIComponent(player[1] ?? ""),
        rest: player[2] && player[2].length > 0 ? player[2] : "/",
      }
    } catch {
      return { portal: "player", segment: player[1] ?? "", rest: player[2] && player[2].length > 0 ? player[2] : "/" }
    }
  }
  const parent = p.match(/^\/parent\/([^/]+)(\/.*)?$/)
  if (parent) {
    try {
      return {
        portal: "parent",
        segment: decodeURIComponent(parent[1] ?? ""),
        rest: parent[2] && parent[2].length > 0 ? parent[2] : "/",
      }
    } catch {
      return { portal: "parent", segment: parent[1] ?? "", rest: parent[2] && parent[2].length > 0 ? parent[2] : "/" }
    }
  }
  return null
}

/** Rest path after segment — same shape as `dashboard-route-policy` `restPath` (`""` = home). */
export function freePortalRestPath(parsed: FreePortalParse): string {
  const r = parsed.rest.replace(/\/$/, "") || ""
  if (r === "" || r === "/") return ""
  return r.startsWith("/") ? r : `/${r}`
}
