/**
 * Team player join codes (teams.player_code): trim, uppercase, collapse whitespace.
 * Use for all lookups and API payloads so QR, manual entry, and DB stay consistent.
 */
export function normalizePlayerJoinCode(code: string): string {
  return String(code ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .toUpperCase()
}
