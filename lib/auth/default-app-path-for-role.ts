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
      return "/dashboard"
    default:
      return "/dashboard"
  }
}
