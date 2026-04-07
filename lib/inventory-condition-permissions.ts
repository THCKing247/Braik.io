import { ROLES, type Role } from "@/lib/auth/roles"
import type { UserMembership } from "@/lib/auth/rbac"

/** Primary varsity head coach: `team_members.head_coach` with is_primary not false (legacy null counts as primary). */
export function isPrimaryVarsityHeadCoach(m: Pick<UserMembership, "role" | "isPrimaryHeadCoach">): boolean {
  if (m.role !== ROLES.HEAD_COACH) return false
  return m.isPrimaryHeadCoach !== false
}

/** Assistants + non-primary head coaches (e.g. JV / freshman head) may submit condition reports. */
export function canSubmitInventoryConditionReport(m: Pick<UserMembership, "role" | "isPrimaryHeadCoach">): boolean {
  if (m.role === ROLES.ASSISTANT_COACH) return true
  if (m.role === ROLES.HEAD_COACH && m.isPrimaryHeadCoach === false) return true
  return false
}

export function canApproveInventoryConditionReports(m: Pick<UserMembership, "role" | "isPrimaryHeadCoach">): boolean {
  return isPrimaryVarsityHeadCoach(m)
}

/** Athletic director and similar: view queue/history without approving (server gates writes). */
export function canViewInventoryConditionReports(role: Role): boolean {
  return (
    role === ROLES.HEAD_COACH ||
    role === ROLES.ASSISTANT_COACH ||
    role === ROLES.ATHLETIC_DIRECTOR ||
    role === ROLES.SCHOOL_ADMIN
  )
}
