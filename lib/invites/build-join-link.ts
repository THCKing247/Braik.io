/**
 * Build the full join URL for a player invite token.
 * Used by send-email, send-sms, and UI copy.
 */
export function buildJoinLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const url = base ? `${base.replace(/\/$/, "")}/join` : "/join"
  const params = new URLSearchParams({ token })
  return `${url}?${params.toString()}`
}
