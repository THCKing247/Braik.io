"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchCoachPaymentsCollections, fetchCoachPaymentsStatus } from "@/lib/api/payments/payments"
import { queryKeys } from "@/lib/queries/keys"

export { queryKeys }

export function useCoachPaymentsStatusQuery(teamId: string, enabled = true) {
  const normalizedTeamId = teamId.trim()
  return useQuery({
    queryKey: queryKeys.payments.coachStatus(normalizedTeamId),
    queryFn: () => fetchCoachPaymentsStatus(normalizedTeamId),
    enabled: Boolean(normalizedTeamId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useCoachPaymentsCollectionsQuery(teamId: string, enabled = true) {
  const normalizedTeamId = teamId.trim()
  return useQuery({
    queryKey: queryKeys.payments.coachCollections(normalizedTeamId),
    queryFn: () => fetchCoachPaymentsCollections(normalizedTeamId),
    enabled: Boolean(normalizedTeamId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
