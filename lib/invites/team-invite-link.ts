import { resolveTrustedAppOrigin } from "@/lib/invites/resolve-invite-app-origin"

/**
 * Absolute URL for staff/coach team invitation acceptance (`/invite/[token]`).
 * Returns `null` when the public app origin cannot be resolved (avoid broken links in email).
 */
export function buildTeamInviteAcceptUrl(token: string, request?: Request): string | null {
  const r = resolveTrustedAppOrigin({ request })
  if (!r.ok) return null
  return `${r.origin}/invite/${encodeURIComponent(token)}`
}
