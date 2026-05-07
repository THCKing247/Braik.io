import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

/** POST /api/roster/[playerAccountId]/invite — create or refresh token + optional join link fields. */
export async function postRosterPlayerInvite(playerAccountId: string): Promise<unknown> {
  const response = await fetchWithTimeout(`/api/roster/${encodeURIComponent(playerAccountId)}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? "Failed to generate invite")
  }
  return data
}

/** POST /api/roster/[playerAccountId]/invite/revoke */
export async function postRosterInviteRevoke(playerAccountId: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/roster/${encodeURIComponent(playerAccountId)}/invite/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? "Failed to revoke invite")
  }
}
