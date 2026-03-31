/**
 * Route classification for Capacitor app unlock / marketing bypass.
 */

const MARKETING_EXACT = new Set([
  "/",
  "/features",
  "/pricing",
  "/about",
  "/why-braik",
  "/faq",
  "/terms",
  "/privacy",
  "/acceptable-use",
  "/ai-transparency",
  "/waitlist",
])

export function isNativeMarketingSurface(pathname: string): boolean {
  if (pathname.startsWith("/recruiting")) return false
  if (MARKETING_EXACT.has(pathname)) return true
  if (pathname.startsWith("/features/") || pathname.startsWith("/pricing/")) return true
  return false
}

/** Paths where an authenticated user may appear without passing the app unlock gate. */
export function isNativePublicWithoutAppUnlock(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/native-unlock" || pathname === "/forgot-password") {
    return true
  }
  if (pathname.startsWith("/admin/login")) return true
  if (isNativeMarketingSurface(pathname)) return true
  if (pathname.startsWith("/signup") || pathname.startsWith("/waitlist") || pathname.startsWith("/request-access"))
    return true
  if (pathname.startsWith("/join")) return true
  if (pathname.startsWith("/invite")) return true
  if (pathname.startsWith("/recruiting")) return true
  return false
}

/**
 * In the native app, these routes require biometric (if enabled) or password fallback before any UI.
 */
export function nativeRouteRequiresAppUnlock(pathname: string): boolean {
  if (!pathname) return false
  return !isNativePublicWithoutAppUnlock(pathname)
}
