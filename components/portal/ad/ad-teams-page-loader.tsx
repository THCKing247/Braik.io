"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AdTeamsPageClient } from "@/components/portal/ad/ad-teams-page-client"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"

const TEAMS_TABLE_FETCH_MS = 12_000

export function AdTeamsPageLoader() {
  const router = useRouter()
  const [teams, setTeams] = useState<TeamRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const timeoutId = window.setTimeout(() => ac.abort(), TEAMS_TABLE_FETCH_MS)
    ;(async () => {
      try {
        const res = await fetch("/api/ad/pages/teams-table", {
          credentials: "include",
          cache: "no-store",
          signal: ac.signal,
        })
        if (res.status === 401) {
          router.replace("/login?callbackUrl=/dashboard/ad/teams")
          return
        }
        if (res.status === 403) {
          router.replace("/dashboard")
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { teams: TeamRow[] }
        if (!cancelled) setTeams(json.teams)
      } catch (e) {
        if (cancelled) return
        if (e instanceof DOMException && e.name === "AbortError") {
          setError(true)
          return
        }
        setError(true)
      } finally {
        clearTimeout(timeoutId)
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      ac.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once; stable router still triggers false-positive churn in some Next builds.
  }, [])

  if (error) {
    return <p className="text-[#212529]">Could not load teams.</p>
  }
  if (teams === null) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-[#E5E7EB]" />
        <div className="h-64 rounded-xl bg-[#F3F4F6]" />
      </div>
    )
  }

  return <AdTeamsPageClient teams={teams} />
}
