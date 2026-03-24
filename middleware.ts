import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Braik middleware — intentionally lightweight for Netlify Edge:
 * - No Supabase getUser() or DB (token validation runs in Node in dashboard layout — avoids Edge failures).
 * - Only checks presence of sb-access-token for /dashboard and /admin (except /admin/login).
 * Internal client navigations reuse the same cookie; no extra “handshake” per route.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Never run auth or redirects for static assets (avoids ERR_HTTP2_PROTOCOL_ERROR on chunks)
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon")) {
    return NextResponse.next()
  }

  // Legacy calendar deep links used /dashboard/schedule?eventId= — games now live at /dashboard/schedule
  if (pathname === "/dashboard/schedule" && request.nextUrl.searchParams.has("eventId")) {
    const u = request.nextUrl.clone()
    u.pathname = "/dashboard/calendar"
    return NextResponse.redirect(u)
  }

  if (pathname.startsWith("/api/dev/")) {
    if (process.env.NODE_ENV === "production") {
      const expectedSeedKey = process.env.SEED_KEY
      const providedSeedKey = request.headers.get("x-seed-key")
      if (!expectedSeedKey || !providedSeedKey || providedSeedKey !== expectedSeedKey) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.next()
  }

  const requiresAuth = pathname.startsWith("/dashboard") || pathname.startsWith("/admin")
  if (!requiresAuth) {
    return NextResponse.next()
  }

  // Admin login is its own portal; allow unauthenticated access
  if (pathname === "/admin/login") {
    return NextResponse.next()
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    return NextResponse.redirect(loginUrl)
  }

  // Only check that an auth cookie is present. Token validation runs in Node (dashboard layout)
  // because Supabase getUser() can fail on Netlify Edge even for valid tokens.
  const accessToken = request.cookies.get("sb-access-token")?.value
  if (!accessToken) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("callbackUrl", pathname)
    // Do not clear auth cookies on redirect: they may be valid but not sent (e.g. race).
    // Clearing here could wipe a valid session and cause random sign-outs.
    return NextResponse.redirect(loginUrl)
  }

  // Let Server Components distinguish AD portal routes from the Head Coach dashboard shell.
  if (pathname.startsWith("/dashboard")) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-dashboard-pathname", pathname)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/dev/:path*"],
}
