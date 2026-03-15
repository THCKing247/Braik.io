/**
 * Generate a URL-safe slug for a player recruiting profile.
 * Format: firstname-lastname-gradyear or firstname-lastname-id (fallback).
 */
export function generatePlayerSlug(firstName: string, lastName: string, graduationYear?: number | null, playerId?: string): string {
  const first = (firstName ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") || "player"
  const last = (lastName ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") || "unknown"
  const base = `${first}-${last}`
  if (graduationYear != null && Number.isFinite(graduationYear)) {
    return `${base}-${graduationYear}`.replace(/-+/g, "-")
  }
  if (playerId) {
    return `${base}-${playerId.slice(0, 8)}`.replace(/-+/g, "-")
  }
  return base.replace(/-+/g, "-")
}

/** Check if value looks like a UUID (with or without dashes). */
export function isUuid(value: string): boolean {
  const hex = value.replace(/-/g, "")
  return /^[0-9a-f]{32}$/i.test(hex)
}
