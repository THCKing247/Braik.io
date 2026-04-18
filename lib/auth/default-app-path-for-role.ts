import { defaultDashboardEntryForPortal } from "@/lib/portal/dashboard-path"
import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"

/** Sync fallback when async portal resolution is unavailable (shell cache miss, tests). */
function portalKindFromSessionRole(role?: string | null): BraikPortalKind {
  const r = (role || "").toUpperCase().replace(/ /g, "_")
  if (r === "PLAYER" || r === "ATHLETE") return "player"
  if (r === "PARENT") return "parent"
  if (r === "ATHLETIC_DIRECTOR") return "coach"
  return "coach"
}

/** Fallback when `session.user.defaultAppPath` is unavailable (offline shape, tests). */
export function getDefaultAppPathForRole(role?: string | null) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "/admin/overview"
    case "athletic_director":
      return "/dashboard/ad"
    case "head_coach":
    case "assistant_coach":
    case "player":
    case "parent":
    case "athlete":
      return defaultDashboardEntryForPortal(portalKindFromSessionRole(role))
    default:
      return defaultDashboardEntryForPortal(portalKindFromSessionRole(role))
  }
}
