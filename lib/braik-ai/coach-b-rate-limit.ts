/** Simple in-memory rate limits for AI tool side-effects (messages / notifications). */

type Bucket = { count: number; windowStart: number }

const WINDOW_MS = 60_000
const MAX_OPS_PER_WINDOW = 15
const buckets = new Map<string, Bucket>()

export function checkCoachBActionRateLimit(key: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || now - b.windowStart > WINDOW_MS) {
    b = { count: 0, windowStart: now }
    buckets.set(key, b)
  }
  if (b.count >= MAX_OPS_PER_WINDOW) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - b.windowStart) }
  }
  b.count += 1
  return { ok: true }
}
