/** Game day quick filter options. */
export const GAMEDAY_FILTERS = [
  { id: "run", label: "Run" },
  { id: "pass", label: "Pass" },
  { id: "rpo", label: "RPO" },
  { id: "red_zone", label: "Red Zone" },
  { id: "goal_line", label: "Goal Line" },
  { id: "favorite", label: "Favorite" },
] as const

export type GamedayFilterId = (typeof GAMEDAY_FILTERS)[number]["id"]

/** Match play to filter: by tag (Run, Pass, RPO, Red Zone, Goal Line) or favorite (localStorage). */
export function playMatchesFilter(
  play: { tags?: string[] | null; playType?: string | null },
  filterId: GamedayFilterId,
  favoritePlayIds: Set<string>
): boolean {
  if (filterId === "favorite") return favoritePlayIds.has((play as { id: string }).id)
  const tagLower = filterId === "red_zone" ? "red zone" : filterId === "goal_line" ? "goal line" : filterId
  const hasTag = play.tags?.some((t) => t.toLowerCase() === tagLower)
  if (hasTag) return true
  if (filterId === "run" && play.playType === "run") return true
  if (filterId === "pass" && play.playType === "pass") return true
  if (filterId === "rpo" && (play.playType === "rpo" || hasTag)) return true
  return false
}

export const GAMEDAY_FAVORITES_KEY_PREFIX = "braik-gameday-favorites-"

export function getGamedayFavorites(playbookId: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(GAMEDAY_FAVORITES_KEY_PREFIX + playbookId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

export function setGamedayFavorites(playbookId: string, playIds: string[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(GAMEDAY_FAVORITES_KEY_PREFIX + playbookId, JSON.stringify(playIds))
  } catch {
    // ignore
  }
}

export function toggleGamedayFavorite(playbookId: string, playId: string): boolean {
  const list = getGamedayFavorites(playbookId)
  const has = list.includes(playId)
  if (has) {
    setGamedayFavorites(playbookId, list.filter((id) => id !== playId))
    return false
  }
  setGamedayFavorites(playbookId, [...list, playId])
  return true
}
