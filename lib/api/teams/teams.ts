import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

/** GET /api/teams/[teamId] — team summary for banners / mastery section (non-throwing). */
export async function fetchTeamById(teamId: string): Promise<unknown | null> {
  const res = await fetchWithTimeout(`/api/teams/${encodeURIComponent(teamId)}`, {
    credentials: "same-origin",
  })
  if (!res.ok) return null
  return res.json()
}
