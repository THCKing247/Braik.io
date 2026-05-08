import { ApiError } from "@/lib/api/core/api-error"
import { fetchJson } from "@/lib/api/core/fetch-json"

/** GET /api/roster?teamId=&lite=1 — playbook workspace roster picker (non-throwing on failure). */
export async function fetchRosterLite(teamId: string): Promise<unknown | null> {
  try {
    return await fetchJson(`/api/roster?teamId=${encodeURIComponent(teamId)}&lite=1`, {
      credentials: "same-origin",
    })
  } catch (error) {
    if (error instanceof ApiError) return null
    throw error
  }
}
