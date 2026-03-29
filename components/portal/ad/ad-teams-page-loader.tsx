"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AdTeamsPageClient } from "@/components/portal/ad/ad-teams-page-client"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { AD_TEAMS_TABLE_QUERY_KEY } from "@/lib/ad/load-ad-teams-page-rows"

const FETCH_TIMEOUT_MS = 12_000

async function fetchAdTeamsTable(signal: AbortSignal): Promise<TeamRow[]> {
  const ac = new AbortController()
  const onParentAbort = () => ac.abort()
  signal.addEventListener("abort", onParentAbort, { once: true })
  const timeoutId = window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch("/api/ad/pages/teams-table", {
      credentials: "include",
      cache: "default",
      signal: ac.signal,
    })
    if (!res.ok) {
      const err = new Error(`teams-table ${res.status}`)
      ;(err as Error & { status?: number }).status = res.status
      throw err
    }
    const json = (await res.json()) as { teams: TeamRow[] }
    return json.teams
  } finally {
    signal.removeEventListener("abort", onParentAbort)
    clearTimeout(timeoutId)
  }
}

export function AdTeamsPageLoader() {
  const router = useRouter()

  const q = useQuery({
    queryKey: AD_TEAMS_TABLE_QUERY_KEY,
    queryFn: ({ signal }) => fetchAdTeamsTable(signal),
    staleTime: 90_000,
    gcTime: 20 * 60_000,
    retry: 1,
    // Visibility handler in AdTeamsPageClient invalidates explicitly; avoid duplicate refetch with window focus.
    refetchOnWindowFocus: false,
  })

  if (q.isPending) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-[#E5E7EB]" />
        <div className="h-64 rounded-xl bg-[#F3F4F6]" />
      </div>
    )
  }

  if (q.isError) {
    const status = (q.error as Error & { status?: number })?.status
    if (status === 401) {
      router.replace("/login?callbackUrl=/dashboard/ad/teams")
      return null
    }
    if (status === 403) {
      router.replace("/dashboard")
      return null
    }
    return <p className="text-[#212529]">Could not load teams.</p>
  }

  return <AdTeamsPageClient teams={q.data ?? []} />
}
