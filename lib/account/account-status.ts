/** Stored in `public.users.status` for sales + lifecycle (admin-managed). */
export const ACCOUNT_STATUS_VALUES = [
  "lead",
  "negotiating",
  "approved",
  "invited",
  "active",
  "suspended",
  /** Legacy / compatibility */
  "deactivated",
  "DISABLED",
] as const

export type AccountStatus = (typeof ACCOUNT_STATUS_VALUES)[number]

export function normalizeAccountStatus(raw: string | null | undefined): AccountStatus | null {
  if (!raw || typeof raw !== "string") return null
  const s = raw.trim().toLowerCase()
  const map: Record<string, AccountStatus> = {
    lead: "lead",
    negotiating: "negotiating",
    approved: "approved",
    invited: "invited",
    active: "active",
    suspended: "suspended",
    deactivated: "deactivated",
    disabled: "DISABLED",
  }
  return map[s] ?? null
}
