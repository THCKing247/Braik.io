/**
 * Normalizes player image_url so the frontend can load it.
 * Legacy values may be stored as ./uploads/players/... but must be requested as /api/uploads/players/...
 */
export function normalizePlayerImageUrl(url: string | null | undefined): string | null {
  if (url == null || url.trim() === "") return null
  if (url.startsWith("./uploads/")) return "/api/uploads/" + url.slice("./uploads/".length)
  return url
}
