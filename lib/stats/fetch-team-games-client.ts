import type { TeamGameRow } from "@/lib/team-schedule-games"

/** React Query key: matches dashboard schedule + optional range prefetch. */
export function teamGamesQueryKey(
  teamId: string,
  startDate: string,
  endDate: string
): readonly ["games", string, string, string] {
  return ["games", teamId, startDate, endDate]
}

export const SCHEDULE_TEAM_GAMES_STALE_MS = 5 * 60 * 1000

export async function fetchTeamGamesForRange(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<{ games: TeamGameRow[] }> {
  const params = new URLSearchParams({
    teamId,
    startDate,
    endDate,
  })
  const res = await fetch(`/api/stats/games?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`games ${res.status}`)
  }
  return res.json() as Promise<{ games: TeamGameRow[] }>
}
