import { ApiError } from "@/lib/api/core/api-error"
import { fetchJson } from "@/lib/api/core/fetch-json"

/** POST /api/roster/[playerAccountId]/invite — create or refresh token + optional join link fields. */
export async function postRosterPlayerInvite(playerAccountId: string): Promise<unknown> {
  try {
    return await fetchJson(`/api/roster/${encodeURIComponent(playerAccountId)}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    })
  } catch (error) {
    if (error instanceof ApiError) {
      const msg =
        typeof error.body === "object" && error.body && "error" in error.body
          ? (error.body as { error?: string }).error
          : undefined
      throw new Error(msg ?? "Failed to generate invite")
    }
    throw error
  }
}

/** POST /api/roster/[playerAccountId]/invite/revoke */
export async function postRosterInviteRevoke(playerAccountId: string): Promise<void> {
  try {
    await fetchJson(`/api/roster/${encodeURIComponent(playerAccountId)}/invite/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    })
  } catch (error) {
    if (error instanceof ApiError) {
      const msg =
        typeof error.body === "object" && error.body && "error" in error.body
          ? (error.body as { error?: string }).error
          : undefined
      throw new Error(msg ?? "Failed to revoke invite")
    }
    throw error
  }
}
