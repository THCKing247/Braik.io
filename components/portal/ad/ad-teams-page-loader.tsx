"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AdTeamsPageClient } from "@/components/portal/ad/ad-teams-page-client"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"

export function AdTeamsPageLoader() {
  const router = useRouter()
  const [teams, setTeams] = useState<TeamRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/ad/pages/teams-table", { credentials: "include", cache: "no-store" })
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
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

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
