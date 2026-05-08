"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchTeamById } from "@/lib/api/teams/teams"
import { queryKeys } from "@/lib/queries/keys"

export { queryKeys }

export function useTeamDetailQuery(teamId: string, enabled = true) {
  const normalizedTeamId = teamId.trim()
  return useQuery({
    queryKey: queryKeys.teams.detail(normalizedTeamId),
    queryFn: () => fetchTeamById(normalizedTeamId),
    enabled: Boolean(normalizedTeamId && enabled),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
