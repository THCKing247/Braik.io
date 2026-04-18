/**
 * High-level portal experience for authenticated dashboard users.
 * Distinct from `profiles.role` — e.g. recruiters may still have profile role `user`.
 */
export const BRAIK_PORTAL_KINDS = ["coach", "player", "parent", "recruiter"] as const

export type BraikPortalKind = (typeof BRAIK_PORTAL_KINDS)[number]

export function isBraikPortalKind(v: string | null | undefined): v is BraikPortalKind {
  return typeof v === "string" && (BRAIK_PORTAL_KINDS as readonly string[]).includes(v)
}
