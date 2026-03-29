"use client"

import { Input } from "@/components/ui/input"
import { SPORT_OPTIONS } from "@/lib/pricing-sports"

interface AdTeamFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  sportFilter: string
  onSportFilterChange: (v: string) => void
  /** While the teams-table request is in flight (initial load). */
  disabled?: boolean
}

export function AdTeamFilters({
  search,
  onSearchChange,
  sportFilter,
  onSportFilterChange,
  disabled = false,
}: AdTeamFiltersProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row gap-4 ${disabled ? "pointer-events-none opacity-60" : ""}`}
      aria-busy={disabled || undefined}
    >
      <div className="flex-1">
        <Input
          type="search"
          placeholder="Search by team name..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className="max-w-sm"
        />
      </div>
      <div className="w-full sm:w-48">
        <select
          value={sportFilter}
          onChange={(e) => onSportFilterChange(e.target.value)}
          disabled={disabled}
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:cursor-not-allowed"
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
