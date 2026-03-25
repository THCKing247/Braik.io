"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdTeamFilters } from "./ad-team-filters"
import { AdTeamsTable, type TeamRow } from "./ad-teams-table"
import { AdEmptyState } from "./ad-empty-state"

interface AdTeamsPageClientProps {
  teams: TeamRow[]
}

export function AdTeamsPageClient({ teams: initialTeams }: AdTeamsPageClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sportFilter, setSportFilter] = useState("")

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      clearTimeout(debounce)
      debounce = setTimeout(() => router.refresh(), 400)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(debounce)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [router])

  const filteredTeams = useMemo(() => {
    let list = initialTeams
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(q))
    }
    if (sportFilter) {
      list = list.filter((t) => t.sport === sportFilter)
    }
    return list
  }, [initialTeams, search, sportFilter])

  const isEmpty = initialTeams.length === 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#212529]">Teams</h1>
          <p className="mt-1 text-[#6B7280]">
            Teams from your program and department. New teams are added through signup and provisioning.
          </p>
        </div>
      </div>

      {isEmpty ? (
        <AdEmptyState
          title="No teams in view yet"
          description="When programs and teams are created through signup or provisioning, they will appear here. Use Portal access to open a team in the head coach workspace when listed."
        />
      ) : (
        <>
          <AdTeamFilters
            search={search}
            onSearchChange={setSearch}
            sportFilter={sportFilter}
            onSportFilterChange={setSportFilter}
          />
          {filteredTeams.length === 0 ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-[#6B7280]">
              No teams match your filters.
            </div>
          ) : (
            <AdTeamsTable teams={filteredTeams} />
          )}
        </>
      )}
    </div>
  )
}
