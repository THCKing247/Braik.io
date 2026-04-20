import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { authTimingMiddleware } from "@/lib/auth/login-flow-timing"
import { BRAIK_DASHBOARD_TEAM_HINT_COOKIE } from "@/lib/navigation/dashboard-team-hint-cookie"
import { isSupabaseServerConfigured } from "@/src/lib/supabase-project-env"
import {
  BRAIK_PUBLIC_PLAYER_SIGNUP_HEADER,
  BRAIK_PUBLIC_PLAYER_SIGNUP_HEADER_VALUE,
} from "@/lib/auth/public-player-signup-header"
import {
  canonicalDashboardOrgTeamPathFromLegacyPadded,
  canonicalOrgPortalPathFromLegacyPadded,
} from "@/lib/navigation/canonical-short-id-paths"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Braik middleware — Edge-safe:
 * - No supabase auth/DB in-process; uses Node APIs over fetch for lookups.
 * - Protected routes: presence of `sb-access-token` cookie (validation in Node routes + client shell).
 */
export async function middleware(request: NextRequest) {
  const mwT0 = process.env.BRAIK_MIDDLEWARE_TIMING === "1" ? Date.now() : 0
  const { pathname } = request.nextUrl

  const finish = (res: NextResponse): NextResponse => {
    if (mwT0) authTimingMiddleware(pathname, Date.now() - mwT0)
    return res
  }

  // Never run auth or redirects for static assets (avoids ERR_HTTP2_PROTOCOL_ERROR on chunks)
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon")) {
    return finish(NextResponse.next())
  }

  // Legacy calendar deep links used /dashboard/schedule?eventId= — games now live at /dashboard/schedule
  if (pathname === "/dashboard/schedule" && request.nextUrl.searchParams.has("eventId")) {
    const u = request.nextUrl.clone()
    u.pathname = "/dashboard/calendar"
    return finish(NextResponse.redirect(u))
  }

  /** Public self-serve signup is retired — allow ONLY the player join-code flow at /signup/player */
  if (pathname === "/signup" || pathname.startsWith("/signup/")) {
    if (pathname === "/signup/player" || pathname.startsWith("/signup/player/")) {
      const reqHeaders = new Headers(request.headers)
      reqHeaders.set(BRAIK_PUBLIC_PLAYER_SIGNUP_HEADER, BRAIK_PUBLIC_PLAYER_SIGNUP_HEADER_VALUE)
      return finish(NextResponse.next({ request: { headers: reqHeaders } }))
    }

    const u = request.nextUrl.clone()
    u.pathname = "/request-access"
    u.search = ""
    return finish(NextResponse.redirect(u))
  }

  if (pathname.startsWith("/api/dev/")) {
    if (process.env.NODE_ENV === "production") {
      const expectedSeedKey = process.env.SEED_KEY
      const providedSeedKey = request.headers.get("x-seed-key")
      if (!expectedSeedKey || !providedSeedKey || providedSeedKey !== expectedSeedKey) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return finish(NextResponse.next())
  }

  const requiresAuth =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/org")
  if (!requiresAuth) {
    return finish(NextResponse.next())
  }

  // Admin login is its own portal; allow unauthenticated access
  if (pathname === "/admin/login") {
    return finish(NextResponse.next())
  }

  if (!isSupabaseServerConfigured()) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    return finish(NextResponse.redirect(loginUrl))
  }

  // Only check that an auth cookie is present. JWT validation runs in Node (e.g. GET /api/dashboard/shell)
  // because Supabase getUser() can fail on Netlify Edge even for valid tokens.
  const accessToken = request.cookies.get("sb-access-token")?.value
  if (!accessToken) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    const callbackTarget = `${pathname}${request.nextUrl.search}`
    loginUrl.searchParams.set("callbackUrl", callbackTarget)
    return finish(NextResponse.redirect(loginUrl))
  }

  const cookieHeader = request.headers.get("cookie") ?? ""
  const origin = `${request.nextUrl.protocol}//${request.nextUrl.host}`

  if (pathname.startsWith("/org")) {
    const orgSegMatch = pathname.match(/^\/org\/([^/]+)(\/.*)?$/)
    if (orgSegMatch && UUID_RE.test(orgSegMatch[1] ?? "")) {
      const uuid = orgSegMatch[1] ?? ""
      const rest = orgSegMatch[2] ?? ""
      const lookupUrl = `${origin}/api/routing/org-short-from-uuid?organizationPortalUuid=${encodeURIComponent(uuid)}`
      try {
        const lookupRes = await fetch(lookupUrl, { headers: { cookie: cookieHeader } })
        if (lookupRes.ok) {
          const json = (await lookupRes.json()) as { shortOrgId?: string }
          if (json.shortOrgId) {
            const targetPath = `/org/${json.shortOrgId}${rest}`
            return finish(NextResponse.redirect(new URL(targetPath, request.url)))
          }
        }
      } catch {
        // Fall through — app may render 404.
      }
    }
    const canonOrgPath = canonicalOrgPortalPathFromLegacyPadded(pathname)
    if (canonOrgPath) {
      const u = request.nextUrl.clone()
      u.pathname = canonOrgPath
      return finish(NextResponse.redirect(u))
    }
    return finish(NextResponse.next())
  }

  if (pathname.startsWith("/dashboard")) {
    const canonDashShortIds = canonicalDashboardOrgTeamPathFromLegacyPadded(pathname)
    if (canonDashShortIds) {
      const u = request.nextUrl.clone()
      u.pathname = canonDashShortIds
      return finish(NextResponse.redirect(u))
    }

    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      const legacyTeamId = request.nextUrl.searchParams.get("teamId")?.trim()
      if (legacyTeamId && UUID_RE.test(legacyTeamId)) {
        try {
          const canonRes = await fetch(
            `${origin}/api/routing/team-canonical?teamId=${encodeURIComponent(legacyTeamId)}`,
            { headers: { cookie: cookieHeader } }
          )
          if (canonRes.ok) {
            const payload = (await canonRes.json()) as { path?: string }
            if (payload.path) {
              return finish(NextResponse.redirect(new URL(payload.path, request.url)))
            }
          }
        } catch {
          // Fall through to legacy dashboard + hint cookie behavior.
        }
      }
    }

    const legacyTeamQuery = request.nextUrl.searchParams.get("teamId")?.trim()
    const skipLegacyTeamRedirect =
      pathname.startsWith("/dashboard/org/") ||
      pathname.startsWith("/dashboard/ad") ||
      pathname.startsWith("/dashboard/admin") ||
      pathname.startsWith("/dashboard/recruiter") ||
      pathname.startsWith("/dashboard/recruiting")

    if (
      legacyTeamQuery &&
      UUID_RE.test(legacyTeamQuery) &&
      !skipLegacyTeamRedirect &&
      pathname.startsWith("/dashboard") &&
      pathname !== "/dashboard" &&
      pathname !== "/dashboard/"
    ) {
      try {
        const canonRes = await fetch(
          `${origin}/api/routing/team-canonical?teamId=${encodeURIComponent(legacyTeamQuery)}`,
          { headers: { cookie: cookieHeader } }
        )
        if (canonRes.ok) {
          const payload = (await canonRes.json()) as { path?: string }
          const basePath = payload.path?.trim()
          if (basePath) {
            let tail = pathname.slice("/dashboard".length) || "/"
            if (pathname.startsWith("/dashboard/coach")) {
              tail = pathname.slice("/dashboard/coach".length) || "/"
            }
            if (!tail.startsWith("/")) tail = `/${tail}`
            const target = new URL(request.url)
            target.pathname =
              tail === "/" ? basePath : `${basePath.replace(/\/$/, "")}${tail}`
            target.searchParams.delete("teamId")
            return finish(NextResponse.redirect(target))
          }
        }
      } catch {
        /* fall through to legacy routes */
      }
    }

    // Canonical team URLs must not expose `?teamId=` — identity comes from path segments only.
    if (
      /^\/dashboard\/org\/[^/]+\/team\/[^/]+(?:\/|$)/.test(pathname) &&
      request.nextUrl.searchParams.has("teamId")
    ) {
      const u = request.nextUrl.clone()
      u.searchParams.delete("teamId")
      return finish(NextResponse.redirect(u))
    }

    // Redirect legacy player UUID in canonical roster profile URLs to `/roster/:playerAccountId`.
    const canonPlayerUuidMatch = pathname.match(
      /^\/dashboard\/org\/([^/]+)\/team\/([^/]+)\/roster\/([^/]+)(\/.*)?$/
    )
    if (canonPlayerUuidMatch && UUID_RE.test(canonPlayerUuidMatch[3] ?? "")) {
      const legacyPlayerUuid = canonPlayerUuidMatch[3] ?? ""
      const nested = canonPlayerUuidMatch[4] ?? ""
      try {
        const canonRes = await fetch(
          `${origin}/api/routing/roster-player-canonical?playerId=${encodeURIComponent(legacyPlayerUuid)}&nested=${encodeURIComponent(nested)}`,
          { headers: { cookie: cookieHeader } }
        )
        if (canonRes.ok) {
          const payload = (await canonRes.json()) as { path?: string }
          const nextPath = payload.path?.trim()
          if (nextPath) {
            const target = new URL(request.url)
            target.pathname = nextPath.split("?")[0]
            target.search = request.nextUrl.search
            target.searchParams.delete("teamId")
            return finish(NextResponse.redirect(target))
          }
        }
      } catch {
        /* fall through */
      }
    }

    // Redirect `/dashboard/roster/:playerUuid` (with optional nested path) to canonical org/team roster URL.
    const legacyDashRosterMatch = pathname.match(/^\/dashboard\/roster\/([^/]+)(\/.*)?$/)
    if (legacyDashRosterMatch && UUID_RE.test(legacyDashRosterMatch[1] ?? "")) {
      const legacyPlayerUuid = legacyDashRosterMatch[1] ?? ""
      const nested = legacyDashRosterMatch[2] ?? ""
      try {
        const canonRes = await fetch(
          `${origin}/api/routing/roster-player-canonical?playerId=${encodeURIComponent(legacyPlayerUuid)}&nested=${encodeURIComponent(nested)}`,
          { headers: { cookie: cookieHeader } }
        )
        if (canonRes.ok) {
          const payload = (await canonRes.json()) as { path?: string }
          const nextPath = payload.path?.trim()
          if (nextPath) {
            const target = new URL(request.url)
            target.pathname = nextPath.split("?")[0]
            target.search = request.nextUrl.search
            target.searchParams.delete("teamId")
            return finish(NextResponse.redirect(target))
          }
        }
      } catch {
        /* fall through */
      }
    }

    const canonicalTeamMatch = pathname.match(/^\/dashboard\/org\/([^/]+)\/team\/([^/]+)(?:\/(.*))?$/)
    if (canonicalTeamMatch) {
      const shortOrgId = decodeURIComponent(canonicalTeamMatch[1] ?? "")
      const shortTeamId = decodeURIComponent(canonicalTeamMatch[2] ?? "")
      const rest = canonicalTeamMatch[3] ? `/${canonicalTeamMatch[3]}` : ""
      const lookupUrl = `${origin}/api/routing/team-from-short?shortOrgId=${encodeURIComponent(shortOrgId)}&shortTeamId=${encodeURIComponent(shortTeamId)}`
      try {
        const lookupRes = await fetch(lookupUrl, { headers: { cookie: cookieHeader } })
        if (!lookupRes.ok) {
          return finish(NextResponse.redirect(new URL("/dashboard", request.url)))
        }
        const json = (await lookupRes.json()) as { teamId?: string }
        if (!json.teamId || !UUID_RE.test(json.teamId)) {
          return finish(NextResponse.redirect(new URL("/dashboard", request.url)))
        }
        const rewriteUrl = request.nextUrl.clone()
        rewriteUrl.pathname = rest ? `/dashboard${rest}` : "/dashboard"
        rewriteUrl.searchParams.delete("teamId")
        rewriteUrl.searchParams.set("teamId", json.teamId)
        return finish(NextResponse.rewrite(rewriteUrl))
      } catch {
        return finish(NextResponse.redirect(new URL("/dashboard", request.url)))
      }
    }

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
    return finish(res)
  }

  return finish(NextResponse.next())
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/org/:path*", "/api/dev/:path*", "/signup", "/signup/:path*"],
}
