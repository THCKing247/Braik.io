"use client"

import { Input } from "@/components/ui/input"
import { SPORT_OPTIONS } from "@/lib/pricing-sports"

interface AdTeamFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  sportFilter: string
  onSportFilterChange: (v: string) => void
}

export function AdTeamFilters({
  search,
  onSearchChange,
  sportFilter,
  onSportFilterChange,
}: AdTeamFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <Input
          type="search"
          placeholder="Search by team name..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="w-full sm:w-48">
        <select
          value={sportFilter}
          onChange={(e) => onSportFilterChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        >
          <option value="">All sports</option>
          {SPORT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
