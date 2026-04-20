/**
 * Resolve display photo URL from roster player with fallbacks.
 * Fallback order (exact): 1. photo_url, 2. avatar_url, 3. image_url, 4. imageUrl, 5. initials placeholder (caller).
 * Never use assignment-stored URLs; always resolve from current roster player.
 */
export interface RosterPlayerForSlot {
  id: string
  playerAccountId?: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  photo_url?: string | null
  avatar_url?: string | null
  image_url?: string | null
  imageUrl?: string | null
}

export function getPlayerPhotoUrl(player: RosterPlayerForSlot | null | undefined): string | null {
  if (!player) return null
  const p = player as unknown as Record<string, unknown>
  const photo = p.photo_url ?? p.avatar_url ?? p.image_url ?? p.imageUrl
  if (typeof photo === "string" && photo.trim() !== "") return photo.trim()
  return null
}
