/**
 * Default film title when the coach leaves the title blank — matches `upload/init`
 * server fallback: stem of `sanitizeVideoFileName(fileName)` (extension removed).
 */
export function defaultDisplayTitleFromFileName(fileName: string): string {
  const base = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_")
  const safe = (base.length > 0 ? base.slice(0, 180) : "video") || "video"
  const stem = safe.replace(/\.[^.]+$/, "")
  return stem || "Video"
}
