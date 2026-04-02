import type { QueryClient } from "@tanstack/react-query"
import type { TeamGameRow } from "@/lib/team-schedule-games"

/** Root segment shared by all schedule `useQueries` range keys — use for invalidation. */
export const TEAM_GAMES_QUERY_ROOT = "games" as const

/** Prefix for `invalidateQueries` so all range windows refetch after saves/imports. */
export function teamGamesQueryKeyPrefix(teamId: string): readonly [typeof TEAM_GAMES_QUERY_ROOT, string] {
  return [TEAM_GAMES_QUERY_ROOT, teamId.trim()]
}

/** React Query key: matches dashboard schedule + optional range prefetch. */
export function teamGamesQueryKey(
  teamId: string,
  startDate: string,
  endDate: string
): readonly [typeof TEAM_GAMES_QUERY_ROOT, string, string, string] {
  return [TEAM_GAMES_QUERY_ROOT, teamId.trim(), startDate, endDate]
}

/** After any game mutation, invalidate every cached range for this team. */
export function invalidateTeamGamesQueries(queryClient: QueryClient, teamId: string) {
  return queryClient.invalidateQueries({ queryKey: [...teamGamesQueryKeyPrefix(teamId)] })
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
  const res = await fetch(`/api/stats/games?${params.toString()}`, {
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`games ${res.status}`)
  }
  return res.json() as Promise<{ games: TeamGameRow[] }>
}
