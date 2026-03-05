/**
 * App user roles for public.users.role (display and storage).
 * Used by admin UI, login sync, and any place that reads/writes users.role.
 */
export const USER_ROLE_VALUES = [
  "head_coach",
  "assistant_coach",
  "parent",
  "athlete",
  "admin",
  "user",
] as const

export type UserRole = (typeof USER_ROLE_VALUES)[number]

/** Display labels for public.users.role (e.g. in admin table and dropdowns). */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  head_coach: "Head Coach",
  assistant_coach: "Assistant Coach",
  parent: "Parent",
  athlete: "Athlete",
  admin: "Admin",
  user: "User",
}

/** Map profile/team role (e.g. "player") to public.users.role (e.g. "athlete"). */
export function profileRoleToUserRole(profileRole: string | null | undefined): UserRole {
  if (!profileRole || typeof profileRole !== "string") return "user"
  const normalized = profileRole.trim().toLowerCase().replace(/-/g, "_")
  if (normalized === "player") return "athlete"
  if (USER_ROLE_VALUES.includes(normalized as UserRole)) return normalized as UserRole
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
