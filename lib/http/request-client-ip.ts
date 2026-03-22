/**
 * Best-effort client IP for audit logs (e.g. SMS consent). Trust proxy headers only on the server.
 */
export function getRequestClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first.length > 256 ? first.slice(0, 256) : first
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp.length > 256 ? realIp.slice(0, 256) : realIp
  return null
}
