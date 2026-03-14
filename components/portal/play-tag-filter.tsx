"use client"

import { STARTER_PLAY_TAGS } from "@/lib/constants/play-tags"

export interface PlayTagFilterProps {
  /** Currently selected tag filters. Empty = show all. */
  selectedTags: string[]
  onChange: (tags: string[]) => void
  className?: string
}

/**
 * Lightweight tag filter for play lists. "All" clears filters; clicking a tag toggles it.
 * When one or more tags are selected, filter shows plays that have any of those tags.
 */
export function PlayTagFilter({ selectedTags, onChange, className = "" }: PlayTagFilterProps) {
  const allSelected = selectedTags.length === 0
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="text-xs text-slate-500 mr-1">Tag:</span>
      <button
        type="button"
        onClick={() => onChange([])}
        className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
          allSelected
            ? "bg-slate-700 text-white border-slate-700"
            : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
        }`}
      >
        All
      </button>
      {STARTER_PLAY_TAGS.map((tag) => {
        const selected = selectedTags.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => {
              if (selected) onChange(selectedTags.filter((t) => t !== tag))
              else onChange([...selectedTags, tag])
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
              selected
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}
