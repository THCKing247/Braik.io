import { type TeamGameRow, parseGameDateMs } from "@/lib/team-schedule-games"

/** Merge parallel range query results into one deduped, chronological list (schedule page). */
export function mergeTeamGameRangeQueryResults(
  results: { data?: { games?: TeamGameRow[] } }[]
): TeamGameRow[] {
  const map = new Map<string, TeamGameRow>()
  for (const r of results) {
    for (const g of r.data?.games ?? []) {
      map.set(g.id, g)
    }
  }
  return [...map.values()].sort((a, b) => parseGameDateMs(a.gameDate) - parseGameDateMs(b.gameDate))
}
