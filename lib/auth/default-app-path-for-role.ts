/** Default app entry after sign-in or mobile root redirect (role-aware). */
export function getDefaultAppPathForRole(role?: string | null) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "/admin/dashboard"
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
