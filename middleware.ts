import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const AUTH_COOKIES = ["sb-access-token", "sb-refresh-token"] as const

function clearAuthCookies(response: NextResponse) {
  const isProd = process.env.NODE_ENV === "production"
  for (const name of AUTH_COOKIES) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    })
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
    const res = NextResponse.redirect(loginUrl)
    clearAuthCookies(res)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/dev/:path*"],
}
