import { ROLES } from "@/lib/auth/roles"
import type { UserMembership } from "@/lib/auth/rbac"

/** Primary varsity HC or AD — full ledger, budget, amounts, CRUD where API allows. */
export function canViewFundraisingFinancials(m: UserMembership | null): boolean {
  if (!m) return false
  if (m.role === ROLES.ATHLETIC_DIRECTOR) return true
  if (m.role === ROLES.HEAD_COACH && m.isPrimaryHeadCoach !== false) return true
  return false
}

/** Assistants and JV/freshman head — payment reference cards only (read-only). */
export function canViewFundraisingPaymentRefs(m: UserMembership | null): boolean {
  if (!m) return false
  if (canViewFundraisingFinancials(m)) return true
  if (m.role === ROLES.ASSISTANT_COACH) return true
  if (m.role === ROLES.HEAD_COACH && m.isPrimaryHeadCoach === false) return true
  return false
}

/** Mutations: primary head coach only (AD is read-only per fundraising RLS). */
export function canEditFundraising(m: UserMembership | null): boolean {
  if (!m) return false
  return m.role === ROLES.HEAD_COACH && m.isPrimaryHeadCoach !== false
}

export function isFundraisingModuleRole(m: UserMembership | null): boolean {
  if (!m) return false
  return (
    m.role === ROLES.HEAD_COACH ||
    m.role === ROLES.ASSISTANT_COACH ||
    m.role === ROLES.ATHLETIC_DIRECTOR
  )
}
