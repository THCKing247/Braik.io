"use client"

import { Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import type {
  FilmLibraryFilmStatusFilter,
  FilmLibraryItemType,
} from "@/components/portal/game-video/game-video-types"

export function FilmLibraryToolbarFilters({
  search,
  onSearchChange,
  itemType,
  onItemTypeChange,
  filmStatus,
  onFilmStatusChange,
  tagFilter,
  onTagFilterChange,
  taggingEnabled,
  tagOptions,
  filmStatusDisabled,
  tagFilterDisabled,
}: {
  search: string
  onSearchChange: (v: string) => void
  itemType: FilmLibraryItemType
  onItemTypeChange: (v: FilmLibraryItemType) => void
  filmStatus: FilmLibraryFilmStatusFilter
  onFilmStatusChange: (v: FilmLibraryFilmStatusFilter) => void
  tagFilter: string
  onTagFilterChange: (v: string) => void
  taggingEnabled: boolean
  tagOptions: string[]
  filmStatusDisabled?: boolean
  tagFilterDisabled?: boolean
}) {
  const sel =
    "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm md:text-sm"

  return (
    <div className="rounded-lg border border-border bg-muted/25 px-3 py-2.5 shadow-sm md:px-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:text-[11px]">
        <Filter className="h-3 w-3 shrink-0 text-primary" aria-hidden />
        Library query
      </div>
      <div className="flex flex-wrap items-end gap-2 md:gap-2.5">
        <div className="min-w-[min(100%,14rem)] flex-[2_1_160px]">
          <label className="sr-only" htmlFor="film-lib-search">
            Search library
          </label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="film-lib-search"
              className="h-9 border bg-background pl-8 text-xs md:text-sm"
              placeholder="Search titles, tags, notes…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="w-[7.5rem] min-w-0 shrink-0">
          <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">View</label>
          <select
            className={sel}
            value={itemType}
            onChange={(e) => onItemTypeChange(e.target.value as FilmLibraryItemType)}
          >
            <option value="all">All</option>
            <option value="films">Films</option>
            <option value="clips">Clips</option>
          </select>
        </div>
        <div className="w-[7.5rem] min-w-0 shrink-0">
          <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Film status</label>
          <select
            className={`${sel} disabled:opacity-50`}
            value={filmStatus}
            onChange={(e) => onFilmStatusChange(e.target.value as FilmLibraryFilmStatusFilter)}
            disabled={filmStatusDisabled}
          >
            <option value="all">Any</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
          </select>
        </div>
        {taggingEnabled && (
          <div className="min-w-[8.5rem] flex-1 basis-[9rem]">
            <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Clip tag</label>
            <select
              className={`${sel} disabled:opacity-50`}
              value={tagFilter}
              onChange={(e) => onTagFilterChange(e.target.value)}
              disabled={tagFilterDisabled}
            >
              <option value="">Any tag</option>
              {tagOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
