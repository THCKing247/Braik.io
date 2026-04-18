/**
 * Role / portal kind exports — thin barrel so imports can use `@/lib/roles`.
 * Canonical definitions live under `@/lib/portal` to avoid duplication.
 */
export type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"
export { BRAIK_PORTAL_KINDS, isBraikPortalKind } from "@/lib/portal/braik-portal-kind"
export { resolveBraikPortalKind } from "@/lib/portal/resolve-portal-kind"
export type { ResolvePortalKindInput } from "@/lib/portal/resolve-portal-kind"
export { ROLES, type Role } from "@/lib/auth/roles"
