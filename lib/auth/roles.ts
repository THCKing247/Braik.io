export const ROLES = {
  HEAD_COACH: "HEAD_COACH",
  ASSISTANT_COACH: "ASSISTANT_COACH",
  ATHLETIC_DIRECTOR: "ATHLETIC_DIRECTOR",
  PLAYER: "PLAYER",
  PARENT: "PARENT",
  SCHOOL_ADMIN: "SCHOOL_ADMIN",
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

export function canManageTeam(role: Role): boolean {
  return role === ROLES.HEAD_COACH || role === ROLES.SCHOOL_ADMIN || role === ROLES.ATHLETIC_DIRECTOR
}

export function canEditRoster(role: Role): boolean {
  return role === ROLES.HEAD_COACH || role === ROLES.ASSISTANT_COACH
}

export function canManageBilling(role: Role): boolean {
  return role === ROLES.HEAD_COACH || role === ROLES.ATHLETIC_DIRECTOR
}

export function canPostAnnouncements(role: Role): boolean {
  return role === ROLES.HEAD_COACH || role === ROLES.ASSISTANT_COACH
}

export function canViewPayments(role: Role): boolean {
  return role === ROLES.HEAD_COACH || role === ROLES.ASSISTANT_COACH || role === ROLES.SCHOOL_ADMIN
}

