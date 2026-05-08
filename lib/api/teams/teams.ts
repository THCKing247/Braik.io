import { ApiError } from "@/lib/api/core/api-error"
import { fetchJson } from "@/lib/api/core/fetch-json"

/** GET /api/teams/[teamId] — team summary for banners / mastery section (non-throwing). */
export async function fetchTeamById(teamId: string): Promise<unknown | null> {
  try {
    return await fetchJson(`/api/teams/${encodeURIComponent(teamId)}`, {
      credentials: "same-origin",
    })
  } catch (error) {
    if (error instanceof ApiError) return null
    throw error
  }
}
