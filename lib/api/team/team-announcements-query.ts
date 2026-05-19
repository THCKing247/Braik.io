"use client"

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { fetchJson } from "@/lib/api/core/fetch-json"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"

export type TeamAnnouncementsResponse = {
  announcements: TeamAnnouncementRow[]
}

export function teamAnnouncementsQueryKey(teamId: string) {
  return ["teams", teamId, "team-announcements"] as const
}

export async function fetchTeamAnnouncements(teamId: string): Promise<TeamAnnouncementRow[]> {
  const data = await fetchJson<TeamAnnouncementsResponse>(
    `/api/teams/${encodeURIComponent(teamId)}/team-announcements`,
    { credentials: "same-origin" }
  )
  return Array.isArray(data.announcements) ? data.announcements : []
}

/** One GET /api/teams/.../team-announcements per teamId per session (shared with dashboard bootstrap seed). */
export function useTeamAnnouncementsQuery(opts: {
  teamId: string
  enabled?: boolean
  initialData?: TeamAnnouncementRow[]
}) {
  const { teamId, enabled = true, initialData } = opts
  return useQuery({
    queryKey: teamAnnouncementsQueryKey(teamId),
    queryFn: () => fetchTeamAnnouncements(teamId),
    enabled: Boolean(teamId && enabled),
    initialData,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function seedTeamAnnouncementsCache(
  queryClient: QueryClient,
  teamId: string,
  announcements: TeamAnnouncementRow[]
) {
  queryClient.setQueryData(teamAnnouncementsQueryKey(teamId), announcements)
}
