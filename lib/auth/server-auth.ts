/**
 * Server-side Braik session from cookies. Uses `supabase.auth.getUser(jwt)` and refresh-token exchange only.
 * Intentionally does not call `supabase.auth.getSession()` on the server (avoids blocking session reads in RSC).
 */
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { jwtDecode } from "jwt-decode"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getSupabaseAnonKey, getSupabaseProjectUrl, isSupabaseServerConfigured } from "@/src/lib/supabase-project-env"
import { readPersistLongSessionFromCookies } from "@/lib/auth/persist-session-cookie"
import { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"
import { resolvePortalEntryPath } from "@/lib/auth/portal-entry-path"
import { adTeamsFlowPerfLog, shouldLogAdTeamsFlowPerf } from "@/lib/ad/ad-teams-table-perf"
import { perfLogAuthVerbose } from "@/lib/perf/braik-perf-server"

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
  /** Raw `profiles.role` for server-side access prefetch (avoids duplicate profile reads). */
  profileRoleDb?: string | null
  profileTeamId?: string | null
  profileSchoolId?: string | null
  /** From `profiles.full_name` — loaded with the same query as role/team (settings and display). */
  profileFullName?: string | null
}

export type RequestUserLiteResult = {
  user: RequestUserLite
  refreshedSession?: RefreshedSession
}

type SupabaseJwt = {
  sub: string
  email?: string
  exp?: number
  aud?: string | string[]
  role?: string
}

/**
 * Refresh Supabase session using refresh_token (Supabase Auth REST API).
 * Requires project URL and anon key (see `supabase-project-env`).
 */
async function refreshSupabaseSession(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
} | null> {
  const url = getSupabaseProjectUrl()
  const anonKey = getSupabaseAnonKey()
  if (!url || !anonKey) {
    if (AUTH_DEBUG) console.warn("[auth] refresh skipped: missing Supabase URL or anon key")
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
    .select("role, is_platform_owner")
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
    defaultAppPath = getDefaultAppPathForRole(rawRole)
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
    supabase.from("profiles").select("role, team_id, school_id, full_name").eq("id", userId).maybeSingle(),
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
    profileRoleDb: profile?.role ?? null,
    profileTeamId: (profile?.team_id as string | null | undefined) ?? null,
    profileSchoolId: (profile?.school_id as string | null | undefined) ?? null,
    profileFullName: (profile?.full_name as string | null | undefined) ?? null,
  }
}

/**
 * Same cookie/token flow as `getServerSession`, but returns `RequestUserLite` (cheaper DB reads).
 */
export async function getRequestUserLite(): Promise<RequestUserLiteResult | null> {
  const tAll = performance.now()
  const logAuth = (payload: Record<string, unknown>) => {
    perfLogAuthVerbose("auth.getRequestUserLite", payload)
  }

  if (!isSupabaseServerConfigured()) {
    logAuth({ ms: Math.round(performance.now() - tAll), outcome: "no_supabase_config" })
    return null
  }

  const cookieStore = cookies()
  const accessToken = cookieStore.get("sb-access-token")?.value
  const refreshToken = cookieStore.get("sb-refresh-token")?.value

  if (accessToken) {
    const devLog = shouldLogAdTeamsFlowPerf()
    let decoded: SupabaseJwt | null = null
    const tJwt = performance.now()

    try {
      decoded = jwtDecode<SupabaseJwt>(accessToken)
    } catch (err) {
      if (AUTH_DEBUG) console.warn("[auth] lite: jwt decode failed", err)
      decoded = null
    }

    if (devLog) adTeamsFlowPerfLog("getRequestUserLite", "jwt_decode", performance.now() - tJwt)

    const nowSeconds = Math.floor(Date.now() / 1000)
    const tokenExpired = decoded?.exp ? decoded.exp <= nowSeconds : false

    if (decoded?.sub && decoded?.email && !tokenExpired) {
      const tLite = performance.now()
      const user = await buildSessionUserLite(decoded.sub, decoded.email)
      if (devLog) adTeamsFlowPerfLog("getRequestUserLite", "buildSessionUserLite", performance.now() - tLite)
      logAuth({
        ms: Math.round(performance.now() - tAll),
        outcome: "ok_jwt_decode",
        userId: user.id,
        profile_ms: Math.round(performance.now() - tLite),
      })
      return { user }
    }

    if (AUTH_DEBUG) {
      console.warn("[auth] lite: access token missing required claims or expired", {
        hasSub: Boolean(decoded?.sub),
        hasEmail: Boolean(decoded?.email),
        tokenExpired,
      })
    }
  }

  if (refreshToken) {
    const devLog = shouldLogAdTeamsFlowPerf()
    const refreshed = await refreshSupabaseSession(refreshToken)
    if (refreshed) {
      const tLite = performance.now()
      const user = await buildSessionUserLite(refreshed.user.id, refreshed.user.email ?? "")
      if (devLog) adTeamsFlowPerfLog("getRequestUserLite", "buildSessionUserLite", performance.now() - tLite)
      logAuth({
        ms: Math.round(performance.now() - tAll),
        outcome: "ok_refresh_token",
        userId: user.id,
        profile_ms: Math.round(performance.now() - tLite),
        refreshed_session: true,
      })
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

  logAuth({ ms: Math.round(performance.now() - tAll), outcome: "no_session" })
  return null
}

/**
 * Get the current session from Supabase Auth.
 * - If sb-access-token is valid, uses it.
 * - If access token is missing/expired but sb-refresh-token exists, refreshes and returns session plus refreshedSession (caller should set cookies on response).
 * Returns null only when there is no valid session and no successful refresh.
 */
export async function getServerSession(): Promise<SessionResult | null> {
  if (!isSupabaseServerConfigured()) {
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