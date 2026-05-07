import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

/** GET /api/roster?teamId=&lite=1 — playbook workspace roster picker (non-throwing on failure). */
export async function fetchRosterLite(teamId: string): Promise<unknown | null> {
  const res = await fetchWithTimeout(`/api/roster?teamId=${encodeURIComponent(teamId)}&lite=1`, {
    credentials: "same-origin",
  })
  if (!res.ok) return null
  return res.json()
}
