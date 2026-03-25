/**
 * Per-user, per-team pin overrides for the dashboard announcements card.
 * Merges with server `is_pinned` in `lib/team-announcements.ts` (effective pin).
 */

export type StoredAnnouncementPinOverrides = {
  pinned: string[]
  unpinned: string[]
}

const STORAGE_VERSION = 1

export function announcementPinStorageKey(userId: string, teamId: string): string {
  return `braik_dash_ann_pins_v${STORAGE_VERSION}:${userId}:${teamId}`
}

export function loadAnnouncementPinOverrides(
  userId: string,
  teamId: string
): { pinned: Set<string>; unpinned: Set<string> } {
  if (typeof window === "undefined") {
    return { pinned: new Set(), unpinned: new Set() }
  }
  try {
    const raw = localStorage.getItem(announcementPinStorageKey(userId, teamId))
    if (!raw) return { pinned: new Set(), unpinned: new Set() }
    const j = JSON.parse(raw) as Partial<StoredAnnouncementPinOverrides>
    return {
      pinned: new Set(Array.isArray(j.pinned) ? j.pinned : []),
      unpinned: new Set(Array.isArray(j.unpinned) ? j.unpinned : []),
    }
  } catch {
    return { pinned: new Set(), unpinned: new Set() }
  }
}

export function saveAnnouncementPinOverrides(
  userId: string,
  teamId: string,
  pinned: Set<string>,
  unpinned: Set<string>
): void {
  if (typeof window === "undefined") return
  try {
    const payload: StoredAnnouncementPinOverrides = {
      pinned: [...pinned],
      unpinned: [...unpinned],
    }
    localStorage.setItem(announcementPinStorageKey(userId, teamId), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}
