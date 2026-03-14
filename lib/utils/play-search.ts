import type { PlayRecord } from "@/types/playbook"

/**
 * Filters plays by selected tags. Empty selectedTags = no filter (return all).
 * Otherwise returns plays that have at least one of the selected tags.
 */
export function filterPlaysByTags(plays: PlayRecord[], selectedTags: string[]): PlayRecord[] {
  if (selectedTags.length === 0) return plays
  return plays.filter((play) => (play.tags ?? []).some((t) => selectedTags.includes(t)))
}

/**
 * Filters plays by search query (case-insensitive).
 * Matches: play name, any tag, formation name, sub-formation name.
 */
export function filterPlaysBySearch(plays: PlayRecord[], query: string): PlayRecord[] {
  const q = query.trim().toLowerCase()
  if (!q) return plays
  return plays.filter((play) => {
    if (play.name?.toLowerCase().includes(q)) return true
    if (play.tags?.some((t) => t.toLowerCase().includes(q))) return true
    if (play.formation?.toLowerCase().includes(q)) return true
    if (play.subFormation?.toLowerCase().includes(q)) return true
    if (play.subcategory?.toLowerCase().includes(q)) return true
    return false
  })
}
