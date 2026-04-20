const PRESETS_KEY = "braik-dev-console-presets-v1"
const RECENT_KEY = "braik-dev-console-recent-v1"

export type SavedPreset = {
  id: string
  name: string
  /** Opaque snapshot — JSON stringified draft */
  snapshot: string
  savedAt: string
}

export function loadPresets(): SavedPreset[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as SavedPreset[]
    return Array.isArray(j) ? j : []
  } catch {
    return []
  }
}

export function savePresets(presets: SavedPreset[]) {
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, 24)))
  } catch {
    /* quota */
  }
}

export function pushRecentSearch(label: string) {
  try {
    const prev = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[]
    const next = [label, ...prev.filter((x) => x !== label)].slice(0, 12)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as string[]
    return Array.isArray(j) ? j : []
  } catch {
    return []
  }
}
