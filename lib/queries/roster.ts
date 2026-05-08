"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchRosterLite } from "@/lib/api/roster/players"
import { queryKeys } from "@/lib/queries/keys"

export { queryKeys }

export function useRosterLiteQuery(teamId: string, enabled = true) {
  const normalizedTeamId = teamId.trim()
  return useQuery({
    queryKey: queryKeys.roster.lite(normalizedTeamId),
    queryFn: () => fetchRosterLite(normalizedTeamId),
    enabled: Boolean(normalizedTeamId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
