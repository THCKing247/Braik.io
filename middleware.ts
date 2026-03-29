import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { BRAIK_DASHBOARD_TEAM_HINT_COOKIE } from "@/lib/navigation/dashboard-team-hint-cookie"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Braik middleware — synchronous, Edge-safe:
 * - No supabase.auth.getSession(), getUser(), JWT verification, or DB.
 * - Protected routes: presence of `sb-access-token` cookie only (validation in Node API routes + client shell).
 */
export function middleware(request: NextRequest): NextResponse {
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

  // Only check that an auth cookie is present. JWT validation runs in Node (e.g. GET /api/dashboard/shell)
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

  if (pathname.startsWith("/dashboard")) {
    const res = NextResponse.next()

    const isDashboardRoot = pathname === "/dashboard" || pathname === "/dashboard/"
    if (isDashboardRoot) {
      const teamId = request.nextUrl.searchParams.get("teamId")
      const isProd = process.env.NODE_ENV === "production"
      if (teamId && UUID_RE.test(teamId)) {
        res.cookies.set(BRAIK_DASHBOARD_TEAM_HINT_COOKIE, teamId, {
          path: "/",
          maxAge: 60 * 60 * 8,
          sameSite: "lax",
          secure: isProd,
          httpOnly: true,
        })
      } else if (!request.nextUrl.searchParams.has("teamId")) {
        res.cookies.set(BRAIK_DASHBOARD_TEAM_HINT_COOKIE, "", {
          path: "/",
          maxAge: 0,
          sameSite: "lax",
          secure: isProd,
          httpOnly: true,
        })
      }
    }
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/dev/:path*"],
}
