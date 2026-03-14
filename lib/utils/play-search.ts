import type { PlayRecord } from "@/types/playbook"

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
