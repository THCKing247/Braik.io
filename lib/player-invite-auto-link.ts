/**
 * Player invite auto-link: match authenticated user email/phone to pending player_invites
 * so we can auto-claim a roster spot without the user entering a code.
 *
 * Security:
 * - Never auto-link by player name only.
 * - Never auto-link if multiple pending invites match the same email (user must choose).
 * - Only auto-claim by phone when there is exactly one confident match (normalized).
 */

/** Normalize phone for storage and comparison: digits only, optional leading +. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length >= 10 && phone.trim().startsWith("+")) {
    return `+${digits}`
  }
  return digits
}

/** Compare two normalized phones; true if they represent the same number. */
export function samePhone(a: string, b: string): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (na === nb) return true
  const stripLeading = (s: string) => (s.length > 10 && s.startsWith("+1") ? s.slice(2) : s)
  return stripLeading(na) === stripLeading(nb)
}

export type AutoLinkResult =
  | { linked: true; playerId: string; teamId: string }
  | { linked: false; reason: "none" | "multiple"; inviteIds?: string[] }
