/**
 * Single trusted origin for invite/join links (emails, SMS, API responses).
 * Prefer env; validate URL; optional Request fallback — never emit malformed URLs.
 */

export type ResolveTrustedAppOriginResult =
  | { ok: true; origin: string }
  | { ok: false; code: "APP_ORIGIN_INVALID" | "APP_ORIGIN_MISSING"; message: string }

function trimOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "")
}

function tryParseHttpOrigin(raw: string): string | null {
  const t = trimOrigin(raw)
  if (!t) return null
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    if (!u.hostname) return null
    // Rebuild origin only (no path/query) — avoids `http://host/path` misuse as "base"
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function envOriginCandidates(): string[] {
  const out: string[] = []
  const a = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const b = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const c = process.env.PUBLIC_APP_URL?.trim()
  if (a) out.push(a)
  if (b) out.push(b)
  if (c) out.push(c)
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) out.push(`https://${vercel.replace(/^https?:\/\//, "")}`)
  return out
}

function forwardedOrigin(request: Request): string | null {
  const h = request.headers
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim()
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim()
  if (host && proto && /^https?$/.test(proto)) {
    return tryParseHttpOrigin(`${proto}://${host}`)
  }
  return null
}

/**
 * Resolve the public app origin used in invite links.
 * Order: env (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, PUBLIC_APP_URL, VERCEL_URL),
 * then `new URL(request.url).origin`, then `x-forwarded-*` (last resort).
 */
export function resolveTrustedAppOrigin(options?: { request?: Request }): ResolveTrustedAppOriginResult {
  for (const raw of envOriginCandidates()) {
    const o = tryParseHttpOrigin(raw)
    if (o) return { ok: true, origin: o }
  }

  const req = options?.request
  if (req) {
    try {
      const o = tryParseHttpOrigin(new URL(req.url).origin)
      if (o) return { ok: true, origin: o }
    } catch {
      /* ignore */
    }
    const fwd = forwardedOrigin(req)
    if (fwd) return { ok: true, origin: fwd }
  }

  for (const raw of envOriginCandidates()) {
    if (raw) {
      console.error("[braik-invite] Invalid NEXT_PUBLIC_APP_URL / site URL — could not parse origin:", raw.slice(0, 120))
    }
  }
  return {
    ok: false,
    code: "APP_ORIGIN_MISSING",
    message:
      "Public app URL is not configured or is invalid. Set NEXT_PUBLIC_APP_URL to your site (e.g. https://braik.io).",
  }
}

/** String helper for bootstrap/roster loaders (empty string if unresolved — avoid bad links). */
export function getTrustedAppOriginOrEmpty(request?: Request): string {
  const r = resolveTrustedAppOrigin({ request })
  if (r.ok) return r.origin
  console.warn("[braik-invite] getTrustedAppOriginOrEmpty:", r.message)
  return ""
}
