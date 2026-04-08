/**
 * App user roles for public.users.role (display and storage).
 * Used by admin UI, login sync, and any place that reads/writes users.role.
 */
export const USER_ROLE_VALUES = [
  "head_coach",
  "assistant_coach",
  "athletic_director",
  "parent",
  "player",
  "athlete",
  "admin",
  "user",
] as const

export type UserRole = (typeof USER_ROLE_VALUES)[number]

/** Display labels for public.users.role (e.g. in admin table and dropdowns). */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  head_coach: "Head Coach",
  assistant_coach: "Assistant Coach",
  athletic_director: "Athletic Director",
  parent: "Parent",
  player: "Player",
  athlete: "Athlete",
  admin: "Admin",
  user: "User",
}

/** Map profile/team role (e.g. "player") to public.users.role (e.g. "athlete"). */
export function profileRoleToUserRole(profileRole: string | null | undefined): UserRole {
  if (!profileRole || typeof profileRole !== "string") return "user"
  const normalized = profileRole.trim().toLowerCase().replace(/-/g, "_")
  if (normalized === "player") return "player"
  if (USER_ROLE_VALUES.includes(normalized as UserRole)) return normalized as UserRole
  return "user"
}

function normalizeUserRoleToken(role: string | null | undefined): string {
  return (role ?? "user").trim().toLowerCase().replace(/-/g, "_")
}

/**
 * Admin Accounts UI: `public.users.role` is often still `user` or `athlete` while `profiles.role`
 * holds the real app role (e.g. parent, player). Merge so lists and edits show Parent / Player.
 */
export function effectiveAppRoleForAdmin(
  usersRole: string | null | undefined,
  profileRole: string | null | undefined
): UserRole {
  const u = normalizeUserRoleToken(usersRole)
  const p = profileRole?.trim() ? profileRoleToUserRole(profileRole) : null

  if (u && u !== "user") {
    if (u === "athlete" && p === "player") {
      return "player"
    }
    if (USER_ROLE_VALUES.includes(u as UserRole)) {
      return u as UserRole
    }
  }

  if (p) {
    return p
  }

  if (USER_ROLE_VALUES.includes(u as UserRole)) {
    return u as UserRole
  }
  return "user"
}

/** Map `public.users.role` to `profiles.role` (profiles check has no `athlete`; use `player`). */
export function userRoleToProfileRoleColumn(usersRole: string): string {
  const r = normalizeUserRoleToken(usersRole)
  if (r === "athlete") return "player"
  const allowed = new Set(["player", "head_coach", "assistant_coach", "athletic_director", "parent", "admin", "user"])
  if (allowed.has(r)) return r
  return "user"
}

export function isAdminUserRole(role: string | null | undefined): boolean {
  return typeof role === "string" && role.toLowerCase() === "admin"
}

export function getUserRoleLabel(role: string | null | undefined): string {
  if (!role) return "User"
  const normalized = role.trim().toLowerCase().replace(/-/g, "_")
  return USER_ROLE_LABELS[normalized as UserRole] ?? role
}
