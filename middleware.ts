import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

async function logAdminAccessDenied(request: NextRequest, actorUserId?: string) {
  const internalKey = process.env.ADMIN_AUDIT_INTERNAL_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!internalKey || !actorUserId) {
    return
  }

  const auditUrl = new URL("/api/admin/access-denied", request.url)
  await fetch(auditUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-audit-key": internalKey,
    },
    body: JSON.stringify({
      actorUserId,
      path: request.nextUrl.pathname,
      reason: "non_admin_attempt",
    }),
  }).catch(() => undefined)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  if (pathname === "/admin/login") {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    })

    const hasAdminRole = typeof token?.adminRole === "string" && token.adminRole.toLowerCase() === "admin"
    const isPlatformOwner = token?.isPlatformOwner === true
    if (hasAdminRole || isPlatformOwner) {
      const url = request.nextUrl.clone()
      url.pathname = "/admin/dashboard"
      url.search = ""
      return NextResponse.redirect(url)
    }

    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    url.searchParams.set("callbackUrl", "/admin/dashboard")
    return NextResponse.redirect(url)
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  })

  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  const hasAdminRole = typeof token.adminRole === "string" && token.adminRole.toLowerCase() === "admin"
  const isPlatformOwner = token.isPlatformOwner === true
  if (!hasAdminRole && !isPlatformOwner) {
    await logAdminAccessDenied(request, typeof token.id === "string" ? token.id : undefined)
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
