"use client"

import React, {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { Session } from "@supabase/supabase-js"
import { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"
import { NATIVE_SESSION_UNLOCK_EVENT } from "@/lib/auth/session-unlock-events"
import { supabaseClient } from "@/src/lib/supabaseClient"
import {
  authTimingClient,
  BRAIK_AUTH_LOGIN_SESSION_EVENT,
} from "@/lib/auth/login-flow-timing"

const AUTH_DEBUG = typeof window !== "undefined" && (window as unknown as { __BRAIK_DEBUG_AUTH?: boolean }).__BRAIK_DEBUG_AUTH === true

function authLog(event: string, detail?: Record<string, unknown>) {
  if (AUTH_DEBUG && typeof console !== "undefined") {
    console.info("[auth]", event, detail ?? "")
  }
}

export type SessionResponse = {
  user: {
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
    /** Server-resolved first portal (Phase 2); used when no last-visited path. */
    defaultAppPath?: string
  }
}

export type SessionStatus = "loading" | "authenticated" | "unauthenticated"

type SessionContextValue = {
  data: SessionResponse | null
  status: SessionStatus
  /** Re-run session fetch (e.g. after native biometric unlock restores cookies). */
  refetch: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

type SignInOptions = {
  email?: string
  password?: string
  callbackUrl?: string
  redirect?: boolean
  rememberMe?: boolean
}

export { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"

type ServerAuthSessionPayload = {
  user?: SessionResponse["user"]
  supabaseSession?: {
    access_token: string
    refresh_token: string
    expires_at?: number
  }
}

type ApplyServerAuthOptions = {
  /**
   * When false, `setSession` runs in the background (faster handoff to full-page redirect).
   * When true (default), await `setSession` — use before client-side navigation without full reload.
   */
  awaitSupabaseSession?: boolean
}

/** Sync browser Supabase + React Query seed from login or signup-secure JSON (no extra `/api/auth/login`). */
export async function applyServerAuthSessionPayload(
  payload: ServerAuthSessionPayload,
  options: ApplyServerAuthOptions = {}
): Promise<void> {
  const { awaitSupabaseSession = true } = options

  if (payload.user?.id && typeof window !== "undefined") {
    authTimingClient("sign_in_session_seed_dispatch", { userId: payload.user.id })
    window.dispatchEvent(
      new CustomEvent(BRAIK_AUTH_LOGIN_SESSION_EVENT, {
        detail: { user: payload.user } as SessionResponse,
      })
    )
  }

  const tok = payload.supabaseSession
  if (tok?.access_token && tok.refresh_token) {
    const p = supabaseClient.auth.setSession({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
    })
    if (awaitSupabaseSession) {
      const { error: setErr } = await p
      if (setErr) {
        // setSession failed — httpOnly cookies from server are still valid; navigation uses cookie-based auth.
        authTimingClient("sign_in_set_session_failed_nonfatal", { message: setErr.message })
      }
    } else {
      authTimingClient("sign_in_set_session_deferred")
      void p.then(({ error: setErr }) => {
        if (setErr) {
          authTimingClient("sign_in_set_session_failed_nonfatal", { message: setErr.message })
        }
      })
    }
  }
}

/**
 * Password sign-in only. This is the **only** client path that calls `POST /api/auth/login`
 * (httpOnly cookies + profile upsert). Session hydration elsewhere uses `supabase.auth.getSession()`.
 */
export async function signIn(provider: string, options: SignInOptions = {}) {
  if (provider !== "credentials") {
    return { ok: false, status: 400, error: "UnsupportedProvider" }
  }

  const email = options.email?.trim()
  if (!email || options.password == null || options.password === "") {
    return { ok: false, status: 400, error: "MissingCredentials" }
  }

  const t0 = typeof performance !== "undefined" ? performance.now() : 0
  authTimingClient("sign_in_request_start")

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: options.password,
      callbackUrl: options.callbackUrl || undefined,
      rememberMe: options.rememberMe || false,
    }),
    credentials: "include",
  })

  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean
    error?: string
    role?: string
    redirectTo?: string
    user?: SessionResponse["user"]
    supabaseSession?: {
      access_token: string
      refresh_token: string
      expires_at?: number
    }
  }
  const callbackUrl = options.callbackUrl || data.redirectTo || getDefaultAppPathForRole(data.role)
  const isSuccess = response.ok && data.success === true

  authTimingClient("sign_in_response", {
    ok: isSuccess,
    ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
  })

  if (isSuccess) {
    authLog("SIGNED_IN", { redirectTo: callbackUrl })
    const fullPageRedirect = options.redirect !== false
    if (fullPageRedirect) {
      authTimingClient("sign_in_apply_payload_fire_and_forget", { href: callbackUrl })
      void applyServerAuthSessionPayload(
        {
          user: data.user,
          supabaseSession: data.supabaseSession,
        },
        { awaitSupabaseSession: false }
      )
      authTimingClient("sign_in_full_redirect", { href: callbackUrl })
      window.location.href = callbackUrl
    } else {
      await applyServerAuthSessionPayload(
        {
          user: data.user,
          supabaseSession: data.supabaseSession,
        },
        { awaitSupabaseSession: true }
      )
    }
    return { ok: true, status: response.status, error: undefined, url: callbackUrl }
  }

  return { ok: false, status: response.status, error: data.error || "CredentialsSignin" }
}

export async function signOut(options: { callbackUrl?: string } = {}) {
  authLog("SIGNED_OUT", { reason: "user_initiated" })
  await supabaseClient.auth.signOut().catch(() => null)
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
  const { clearNativeBiometricUnlockLaunchFlag } = await import("@/lib/native/native-unlock-session")
  clearNativeBiometricUnlockLaunchFlag()
  const callbackUrl = options.callbackUrl || "/"
  window.location.href = callbackUrl
}

function mapSupabaseSessionToSessionResponse(session: Session): SessionResponse | null {
  const u = session.user
  if (!u?.id) return null
  const meta = (u.user_metadata || {}) as Record<string, unknown>
  const appMeta = (u.app_metadata || {}) as Record<string, unknown>
  const roleRaw = meta.role ?? appMeta.role
  let role: string | undefined
  if (typeof roleRaw === "string" && roleRaw.trim()) {
    role = roleRaw.trim().toUpperCase().replace(/ /g, "_")
  }
  const teamIdRaw = meta.teamId ?? meta.team_id
  const teamId = typeof teamIdRaw === "string" ? teamIdRaw : undefined
  const name =
    (typeof meta.full_name === "string" ? meta.full_name : null) ??
    (typeof meta.displayName === "string" ? meta.displayName : null) ??
    null
  const isPlatformOwner =
    meta.is_platform_owner === true || appMeta.is_platform_owner === true ? true : undefined

  return {
    user: {
      id: u.id,
      email: u.email ?? "",
      name,
      role,
      teamId,
      isPlatformOwner,
      defaultAppPath: role ? getDefaultAppPathForRole(role) : undefined,
    },
  }
}

function mergePreferRicherSession(
  cached: SessionResponse | null | undefined,
  fromSupabase: SessionResponse | null
): SessionResponse | null {
  if (!fromSupabase?.user?.id) {
    return cached?.user?.id ? cached : null
  }
  if (!cached?.user?.id || cached.user.id !== fromSupabase.user.id) {
    return fromSupabase
  }
  const a = cached.user
  const b = fromSupabase.user
  return {
    user: {
      id: b.id,
      email: b.email || a.email,
      name: a.name ?? b.name,
      role: a.role ?? b.role,
      adminRole: a.adminRole ?? b.adminRole,
      teamId: a.teamId ?? b.teamId,
      teamName: a.teamName ?? b.teamName,
      organizationName: a.organizationName ?? b.organizationName,
      positionGroups: a.positionGroups ?? b.positionGroups,
      isPlatformOwner: a.isPlatformOwner ?? b.isPlatformOwner,
      defaultAppPath: a.defaultAppPath ?? b.defaultAppPath,
    },
  }
}

async function fetchClientSession(queryClient: QueryClient): Promise<SessionResponse | null> {
  authTimingClient("session_fetch_start", { source: "supabase.auth.getSession" })
  const t0 = typeof performance !== "undefined" ? performance.now() : 0
  const cached = queryClient.getQueryData(BRAIK_AUTH_SESSION_QUERY_KEY) as SessionResponse | undefined

  const { data, error } = await supabaseClient.auth.getSession()
  if (error) {
    authLog("SUPABASE_GET_SESSION_ERROR", { message: error.message })
    authTimingClient("session_fetch_done", {
      ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
      hasUser: Boolean(cached?.user?.id),
      error: true,
    })
    return cached?.user?.id ? cached : null
  }

  const mapped = data.session ? mapSupabaseSessionToSessionResponse(data.session) : null
  const merged = mergePreferRicherSession(cached, mapped)

  authLog("INITIAL_SESSION", { hasUser: Boolean(merged?.user?.id) })
  authTimingClient("session_fetch_done", {
    ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
    hasUser: Boolean(merged?.user?.id),
  })
  return merged
}

/**
 * Session is hydrated from Supabase local persistence (`getSession`) + shell/login seeds.
 * Keep “fresh” until explicit invalidation (logout, native unlock, sign-in) so navigations do not
 * re-run the session query or rely on extra network for auth state.
 */
const AUTH_SESSION_STALE_MS = Number.POSITIVE_INFINITY

/** Single source of truth for the client session query — shell/bootstrap seeds merge with `supabase.auth.getSession()`. */
export const BRAIK_AUTH_SESSION_QUERY_KEY = ["braik-auth-session"] as const

/**
 * If React Query has no session yet, seed from dashboard/AD shell payloads so children don’t block on
 * `getSession()` while Supabase hydrates. Merged with `supabase.auth.getSession()` when the query resolves.
 */
export function seedAuthSessionCacheFromShellUser(
  queryClient: QueryClient,
  user: SessionResponse["user"]
): void {
  queryClient.setQueryData(BRAIK_AUTH_SESSION_QUERY_KEY, (prev: SessionResponse | undefined) => {
    if (!user?.id) return prev
    const shellPayload: SessionResponse = { user }
    if (!prev?.user?.id) {
      authTimingClient("session_query_seeded_from_shell", { userId: user.id })
      return shellPayload
    }
    if (prev.user.id !== user.id) return prev
    authTimingClient("session_query_seeded_from_shell", { userId: user.id })
    return mergePreferRicherSession(shellPayload, prev)
  })
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider")
  }
  return ctx
}

/**
 * Client session from `supabase.auth.getSession()` merged with shell/login seeds (no GET `/api/auth/session`).
 * Team dashboard shell and AD bootstrap still supply richer fields via `seedAuthSessionCacheFromShellUser`.
 *
 * Session is cached with React Query (`staleTime: Infinity`, no refetch on mount/window focus). Native
 * biometric unlock invalidates the query.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window === "undefined") return
    const onLoginSeed = (e: Event) => {
      const ce = e as CustomEvent<SessionResponse>
      if (ce.detail?.user?.id) {
        authTimingClient("session_query_seeded_from_login", { userId: ce.detail.user.id })
        queryClient.setQueryData(BRAIK_AUTH_SESSION_QUERY_KEY, (prev: SessionResponse | undefined) =>
          mergePreferRicherSession(ce.detail, prev ?? null)
        )
      }
    }
    window.addEventListener(BRAIK_AUTH_LOGIN_SESSION_EVENT, onLoginSeed as EventListener)
    return () => window.removeEventListener(BRAIK_AUTH_LOGIN_SESSION_EVENT, onLoginSeed as EventListener)
  }, [queryClient])

  useEffect(() => {
    const { data: sub } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.setQueryData(BRAIK_AUTH_SESSION_QUERY_KEY, null)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [queryClient])

  const sessionQueryFn = useCallback(() => fetchClientSession(queryClient), [queryClient])

  const query = useQuery({
    queryKey: BRAIK_AUTH_SESSION_QUERY_KEY,
    queryFn: sessionQueryFn,
    staleTime: AUTH_SESSION_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: false,
  })

  useEffect(() => {
    const onNativeUnlock = () => {
      void queryClient.invalidateQueries({ queryKey: BRAIK_AUTH_SESSION_QUERY_KEY })
    }
    window.addEventListener(NATIVE_SESSION_UNLOCK_EVENT, onNativeUnlock)
    return () => window.removeEventListener(NATIVE_SESSION_UNLOCK_EVENT, onNativeUnlock)
  }, [queryClient])

  const refetchSession = useCallback(
    () => query.refetch().then(() => undefined),
    [query.refetch]
  )

  const value = useMemo<SessionContextValue>(
    () => ({
      data: query.data ?? null,
      status: query.isPending ? "loading" : query.data ? "authenticated" : "unauthenticated",
      refetch: refetchSession,
    }),
    [query.data, query.isPending, refetchSession]
  )

  return React.createElement(SessionContext.Provider, { value }, children)
}

