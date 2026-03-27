import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { readPersistLongSessionFromCookies } from "@/lib/auth/persist-session-cookie"
import { resolvePortalEntryPath } from "@/lib/auth/portal-entry-path"

const AUTH_DEBUG = process.env.DEBUG_AUTH === "true"

export type SessionUser = {
  id: string
  email: string
  name?: string | null
  role?: string
  adminRole?: string
  teamId?: string
  teamName?: string
  organizationName?: string
  positionGroups?: string[] | null
  isPlatformOwner?: boolean
  /** Role-aware default when no last-visited path (Phase 2 portal entry). */
  defaultAppPath?: string
}

export type AppSession = { user: SessionUser }

/** When session was recovered via refresh token; set these on the response so the client gets new cookies. */
export type RefreshedSession = {
  access_token: string
  refresh_token: string
  expires_in: number
}

export type SessionResult = {
  user: SessionUser
  refreshedSession?: RefreshedSession
}

/**
 * Minimal authenticated identity for API routes that only need RBAC and team scoping.
 * Skips `resolvePortalEntryPath`, full profile hydration, and other session UI fields so
 * high-frequency routes avoid extra DB work. Use `getServerSession()` when the client needs
 * `defaultAppPath`, `name`, or full portal session shape.
 */
export type RequestUserLite = {
  id: string
  email: string
  role: string
  teamId?: string
  isPlatformOwner?: boolean
}

export type RequestUserLiteResult = {
  user: RequestUserLite
  refreshedSession?: RefreshedSession
}

/**
 * Refresh Supabase session using refresh_token (Supabase Auth REST API).
 * Requires SUPABASE_URL and anon key (SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY).
 */
async function refreshSupabaseSession(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
} | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    if (AUTH_DEBUG) console.warn("[auth] refresh skipped: missing SUPABASE_URL or anon key")
    return null
  }
  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) {
    if (AUTH_DEBUG) console.warn("[auth] refresh failed:", res.status, await res.text())
    return null
  }
  const data = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    user?: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  }
  if (!data?.access_token || !data?.user?.id) return null
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in ?? 3600,
    user: data.user,
  }
}

/**
 * Build SessionUser from Supabase user id/email and load profile + users.
 */
async function buildSessionUser(
  userId: string,
  email: string,
  userMetadata?: Record<string, unknown>
): Promise<SessionUser> {
  const supabase = getSupabaseServer()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, team_id, full_name")
    .eq("id", userId)
    .maybeSingle()

  let adminRole: string | undefined
  let isPlatformOwner = false
  const { data: appUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  if (appUser) {
    adminRole = appUser.role
    isPlatformOwner = (appUser as { is_platform_owner?: boolean }).is_platform_owner === true
  }

  const rawRole = profile?.role ?? "player"
  const role = rawRole.toUpperCase().replace(/ /g, "_")
  let defaultAppPath = "/dashboard"
  try {
    defaultAppPath = await resolvePortalEntryPath(supabase, userId)
  } catch {
    defaultAppPath = "/dashboard"
  }
  return {
    id: userId,
    email,
    name: (profile?.full_name as string | null) ?? (userMetadata?.full_name as string | null) ?? null,
    role,
    adminRole,
    teamId: profile?.team_id ?? undefined,
    teamName: undefined,
    organizationName: undefined,
    positionGroups: null,
    isPlatformOwner,
    defaultAppPath,
  }
}

/**
 * Load role, team_id, and platform-owner flag only (parallel queries). No portal entry resolution.
 */
async function buildSessionUserLite(userId: string, email: string): Promise<RequestUserLite> {
  const supabase = getSupabaseServer()
  const [profileResult, appUserResult] = await Promise.all([
    supabase.from("profiles").select("role, team_id").eq("id", userId).maybeSingle(),
    supabase.from("users").select("role, is_platform_owner").eq("id", userId).maybeSingle(),
  ])
  const profile = profileResult.data
  const appUser = appUserResult.data as { is_platform_owner?: boolean } | null
  const rawRole = profile?.role ?? "player"
  const role = rawRole.toUpperCase().replace(/ /g, "_")
  return {
    id: userId,
    email,
    role,
    teamId: (profile?.team_id as string | null | undefined) ?? undefined,
    isPlatformOwner: appUser?.is_platform_owner === true,
  }
}

/**
 * Same cookie/token flow as `getServerSession`, but returns `RequestUserLite` (cheaper DB reads).
 */
export async function getRequestUserLite(): Promise<RequestUserLiteResult | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  const cookieStore = cookies()
  const accessToken = cookieStore.get("sb-access-token")?.value
  const refreshToken = cookieStore.get("sb-refresh-token")?.value

  const supabase = getSupabaseServer()

  if (accessToken) {
    const { data: userData, error } = await supabase.auth.getUser(accessToken)
    if (!error && userData?.user?.email) {
      const user = await buildSessionUserLite(userData.user.id, userData.user.email)
      return { user }
    }
    if (AUTH_DEBUG) console.warn("[auth] lite: access token invalid or expired:", error?.message ?? "no user")
  }

  if (refreshToken) {
    const refreshed = await refreshSupabaseSession(refreshToken)
    if (refreshed) {
      const user = await buildSessionUserLite(refreshed.user.id, refreshed.user.email ?? "")
      return {
        user,
        refreshedSession: {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_in: refreshed.expires_in,
        },
      }
    }
  }

  return null
}

/**
 * Get the current session from Supabase Auth.
 * - If sb-access-token is valid, uses it.
 * - If access token is missing/expired but sb-refresh-token exists, refreshes and returns session plus refreshedSession (caller should set cookies on response).
 * Returns null only when there is no valid session and no successful refresh.
 */
export async function getServerSession(): Promise<SessionResult | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  const cookieStore = cookies()
  const accessToken = cookieStore.get("sb-access-token")?.value
  const refreshToken = cookieStore.get("sb-refresh-token")?.value

  if (AUTH_DEBUG) {
    console.info("[auth] cookies:", {
      hasAccess: Boolean(accessToken),
      hasRefresh: Boolean(refreshToken),
    })
  }

  const supabase = getSupabaseServer()

  // 1. Try access token first
  if (accessToken) {
    const { data: userData, error } = await supabase.auth.getUser(accessToken)
    if (!error && userData?.user?.email) {
      if (AUTH_DEBUG) console.info("[auth] INITIAL_SESSION", { userId: userData.user.id })
      const user = await buildSessionUser(
        userData.user.id,
        userData.user.email,
        userData.user.user_metadata as Record<string, unknown> | undefined
      )
      return { user }
    }
    if (AUTH_DEBUG) console.warn("[auth] access token invalid or expired:", error?.message ?? "no user")
  }

  // 2. Try refresh
  if (refreshToken) {
    const refreshed = await refreshSupabaseSession(refreshToken)
    if (refreshed) {
      if (AUTH_DEBUG) console.info("[auth] TOKEN_REFRESHED", { userId: refreshed.user.id })
      const user = await buildSessionUser(
        refreshed.user.id,
        refreshed.user.email ?? "",
        refreshed.user.user_metadata
      )
      return {
        user,
        refreshedSession: {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_in: refreshed.expires_in,
        },
      }
    }
  }

  return null
}

/**
 * Set sb-access-token and sb-refresh-token on a NextResponse using the same options as login.
 * Call this when getServerSession() returns refreshedSession so the client receives new cookies.
 */
export function applyRefreshedSessionCookies(
  res: NextResponse,
  refreshed: RefreshedSession,
  options?: { rememberMe?: boolean }
): void {
  const rememberLong =
    options?.rememberMe ??
    readPersistLongSessionFromCookies((name) => cookies().get(name)?.value)
  const maxAgeAccess = rememberLong ? 60 * 60 * 24 * 7 : refreshed.expires_in
  const maxAgeRefresh = rememberLong ? 60 * 60 * 24 * 90 : 60 * 60 * 24 * 30
  const isProd = process.env.NODE_ENV === "production"
  res.cookies.set("sb-access-token", refreshed.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: maxAgeAccess,
  })
  res.cookies.set("sb-refresh-token", refreshed.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: maxAgeRefresh,
  })
}

/**
 * Alias for getServerSession (Supabase-only; no separate cookie fallback).
 */
export async function getServerSessionOrSupabase(): Promise<SessionResult | null> {
  return getServerSession()
}
