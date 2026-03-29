"use client"

import { useMemo, useState, useEffect, memo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AdTeamFilters } from "./ad-team-filters"
import { AdTeamsTable, AdTeamsTableSkeleton, type TeamRow } from "./ad-teams-table"
import { AdEmptyState } from "./ad-empty-state"
import { AD_TEAMS_TABLE_QUERY_KEY } from "@/lib/ad/ad-teams-table-query"

interface AdTeamsPageClientProps {
  teams: TeamRow[]
  /** First teams-table fetch — show page chrome + table skeleton without blocking on data. */
  initialLoading?: boolean
  /** Background refetch while showing cached rows (soft refresh). */
  isRefreshing?: boolean
}

function AdTeamsPageClientInner({
  teams: initialTeams,
  initialLoading = false,
  isRefreshing = false,
}: AdTeamsPageClientProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [sportFilter, setSportFilter] = useState("")

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: AD_TEAMS_TABLE_QUERY_KEY })
      }, 400)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(debounce)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [queryClient])

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

  const isEmpty = !initialLoading && initialTeams.length === 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#212529]">Teams</h1>
          <p className="mt-1 text-[#6B7280]">
            Teams from your program and department. New teams are added through signup and provisioning; open a
            team’s Head Coach portal from here when listed.
          </p>
        </div>
      </div>

      {initialLoading ? (
        <>
          <AdTeamFilters
            search={search}
            onSearchChange={setSearch}
            sportFilter={sportFilter}
            onSportFilterChange={setSportFilter}
            disabled
          />
          <AdTeamsTableSkeleton rows={10} />
        </>
      ) : isEmpty ? (
        <>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#EFF6FF] p-6">
            <h2 className="text-lg font-semibold text-[#1E40AF]">No teams visible yet</h2>
            <p className="mt-1 text-sm text-[#1E3A8A]">
              Teams are created through signup and provisioning. If you expect teams here, confirm school and
              department linkage with support.
            </p>
          </div>
          <AdEmptyState
            title="No teams in view yet"
            description="When programs and teams are provisioned, they appear here. Use Portal access to open a team in the head coach workspace. Use the Coaches tab for staffing once teams exist."
          />
        </>
      ) : (
        <>
          <AdTeamFilters
            search={search}
            onSearchChange={setSearch}
            sportFilter={sportFilter}
            onSportFilterChange={setSportFilter}
          />
          <div
            className={isRefreshing ? "opacity-[0.92] transition-opacity" : undefined}
            aria-busy={isRefreshing || undefined}
          >
            {filteredTeams.length === 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-[#6B7280]">
                No teams match your filters.
              </div>
            ) : (
              <AdTeamsTable teams={filteredTeams} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export const AdTeamsPageClient = memo(AdTeamsPageClientInner)
