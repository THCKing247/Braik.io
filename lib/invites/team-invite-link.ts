/**
 * Absolute URL for staff/coach team invitation acceptance (`/invite/[token]`).
 */
export function buildTeamInviteAcceptUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ""
  const path = `/invite/${encodeURIComponent(token)}`
  if (!base) return path
  return `${base.replace(/\/$/, "")}${path}`
}
