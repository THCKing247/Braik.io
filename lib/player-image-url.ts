/**
 * Normalizes player image_url so the frontend can load it.
 * - Legacy: ./uploads/players/... -> /api/uploads/players/... (so existing DB values still resolve).
 * - Legacy: /api/uploads/players/... -> returned as-is (served by API route for old uploads).
 * - New: Supabase Storage public URL (https://.../storage/v1/object/public/player-images/...) -> returned as-is.
 */
export function normalizePlayerImageUrl(url: string | null | undefined): string | null {
  if (url == null || url.trim() === "") return null
  const u = url.trim()
  if (u.startsWith("./uploads/")) return "/api/uploads/" + u.slice("./uploads/".length)
  return u
}
