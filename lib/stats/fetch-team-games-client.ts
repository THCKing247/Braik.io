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

/**
 * Same bounds as GET /api/stats/games: inclusive `game_date` vs window start/end (ISO).
 */
export function gameDateInStatsGamesWindow(gameDate: string, startIso: string, endIso: string): boolean {
  const t = Date.parse(gameDate)
  const s = Date.parse(startIso)
  const e = Date.parse(endIso)
  if (!Number.isFinite(t) || !Number.isFinite(s) || !Number.isFinite(e)) return false
  return t >= s && t <= e
}

/**
 * Merge the authoritative row from PATCH/POST mapping into every cached range query for this team.
 * Removes the id from windows where the kickoff no longer belongs (e.g. date moved) so the merged
 * list never drops a game when refetch races a stale CDN/cache response.
 */
export function upsertTeamGameInGamesQueries(queryClient: QueryClient, teamId: string, game: TeamGameRow) {
  const tid = teamId.trim()
  const queries = queryClient.getQueryCache().findAll({
    queryKey: teamGamesQueryKeyPrefix(tid),
    exact: false,
  })
  let placed = false
  for (const q of queries) {
    const key = q.queryKey as readonly unknown[]
    if (key.length !== 4 || key[0] !== TEAM_GAMES_QUERY_ROOT || key[1] !== tid) continue
    const startIso = String(key[2])
    const endIso = String(key[3])
    const inWindow = gameDateInStatsGamesWindow(game.gameDate, startIso, endIso)
    const data = q.state.data as { games?: TeamGameRow[] } | undefined
    const games = data?.games ?? []
    if (inWindow) {
      const next = games.filter((g) => g.id !== game.id)
      next.push(game)
      queryClient.setQueryData(q.queryKey, { games: next })
      placed = true
    } else {
      const next = games.filter((g) => g.id !== game.id)
      if (next.length !== games.length) {
        queryClient.setQueryData(q.queryKey, { games: next })
      }
    }
  }
  if (!placed) {
    const rangeQueries = queries
      .filter((q) => {
        const key = q.queryKey as readonly unknown[]
        return key.length === 4 && key[0] === TEAM_GAMES_QUERY_ROOT && key[1] === tid
      })
      .sort((a, b) => String(a.queryKey[2]).localeCompare(String(b.queryKey[2])))
    const target = rangeQueries.length >= 2 ? rangeQueries[Math.floor(rangeQueries.length / 2)]! : rangeQueries[0]
    if (target) {
      const data = target.state.data as { games?: TeamGameRow[] } | undefined
      const games = data?.games ?? []
      const next = games.filter((g) => g.id !== game.id)
      next.push(game)
      queryClient.setQueryData(target.queryKey, { games: next })
    }
  }
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
