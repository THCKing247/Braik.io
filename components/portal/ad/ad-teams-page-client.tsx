"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
          <p className="mt-1 text-[#6B7280]">Manage all teams in your athletic department.</p>
        </div>
        <Link
          href="/dashboard/ad/teams/new"
          className="inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
        >
          Create team
        </Link>
      </div>

      {isEmpty ? (
        <>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#EFF6FF] p-6">
            <h2 className="text-lg font-semibold text-[#1E40AF]">Get started</h2>
            <p className="mt-1 text-sm text-[#1E3A8A]">
              Create your first team and invite a head coach to start using Braik for your department.
            </p>
            <Link
              href="/dashboard/ad/teams/new"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
            >
              Create your first team
            </Link>
          </div>
          <AdEmptyState
            title="No teams yet"
            description="Create your first team to get started. You can assign head coaches and add rosters later."
            actionLabel="Create team"
            actionHref="/dashboard/ad/teams/new"
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
