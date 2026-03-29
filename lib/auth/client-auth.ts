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

export async function signIn(provider: string, options: SignInOptions = {}) {
  if (provider !== "credentials") {
    return { ok: false, status: 400, error: "UnsupportedProvider" }
  }

  const t0 = typeof performance !== "undefined" ? performance.now() : 0
  authTimingClient("sign_in_request_start")

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: options.email,
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
  }
  const callbackUrl = options.callbackUrl || data.redirectTo || getDefaultAppPathForRole(data.role)
  const isSuccess = response.ok && data.success === true

  authTimingClient("sign_in_response", {
    ok: isSuccess,
    ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
  })

  if (isSuccess) {
    authLog("SIGNED_IN", { redirectTo: callbackUrl })
    if (
      options.redirect === false &&
      data.user?.id &&
      typeof window !== "undefined"
    ) {
      authTimingClient("sign_in_session_seed_dispatch", { userId: data.user.id })
      window.dispatchEvent(
        new CustomEvent(BRAIK_AUTH_LOGIN_SESSION_EVENT, {
          detail: { user: data.user } as SessionResponse,
        })
      )
    }
    if (options.redirect !== false) {
      authTimingClient("sign_in_full_redirect", { href: callbackUrl })
      window.location.href = callbackUrl
    }
    return { ok: true, status: response.status, error: undefined, url: callbackUrl }
  }

  return { ok: false, status: response.status, error: data.error || "CredentialsSignin" }
}

export async function signOut(options: { callbackUrl?: string } = {}) {
  authLog("SIGNED_OUT", { reason: "user_initiated" })
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
  const { clearNativeBiometricUnlockLaunchFlag } = await import("@/lib/native/native-unlock-session")
  clearNativeBiometricUnlockLaunchFlag()
  const callbackUrl = options.callbackUrl || "/"
  window.location.href = callbackUrl
}

const SESSION_RETRY_DELAY_MS = 800
const SESSION_MAX_RETRIES = 1

let sessionFetchInFlight: Promise<SessionResponse | null> | null = null

async function fetchSessionOnce(): Promise<SessionResponse | null> {
  // Client-side Supabase session (supabase-js). With httpOnly auth cookies this is often null until `setSession`; profile still comes from `/api/auth/session`.
  await supabaseClient.auth.getSession().catch(() => null)

  authTimingClient("session_fetch_start", { source: "/api/auth/session" })
  const t0 = typeof performance !== "undefined" ? performance.now() : 0

  let lastError: unknown
  for (let attempt = 0; attempt <= SESSION_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" })
      const data = (await response.json().catch(() => null)) as SessionResponse | { user: null } | null

      if (response.ok) {
        const hasUser = data?.user && typeof (data as SessionResponse).user?.id === "string"
        authLog(attempt === 0 ? "INITIAL_SESSION" : "SESSION_RETRY_OK", {
          hasUser,
          attempt: attempt + 1,
        })
        if (hasUser) {
          authTimingClient("session_fetch_done", {
            ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
            attempt: attempt + 1,
            hasUser: true,
          })
          return data as SessionResponse
        }
        authTimingClient("session_fetch_done", {
          ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
          hasUser: false,
        })
        return null
      }

      if (response.status === 401) {
        authLog("SESSION_401", { attempt: attempt + 1 })
        authTimingClient("session_fetch_401", { ms: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0 })
        return null
      }

      if (response.status >= 500) {
        lastError = new Error(`Session API ${response.status}`)
        authLog("SESSION_SERVER_ERROR", { status: response.status, attempt: attempt + 1 })
        if (attempt < SESSION_MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, SESSION_RETRY_DELAY_MS))
          continue
        }
        return null
      }

      lastError = new Error(`Session API ${response.status}`)
      return null
    } catch (err) {
      lastError = err
      authLog("SESSION_NETWORK_ERROR", { attempt: attempt + 1 })
      if (attempt < SESSION_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, SESSION_RETRY_DELAY_MS))
        continue
      }
      authLog("SESSION_NULL_UNEXPECTED", { reason: "network_or_server_after_retry" })
      return null
    }
  }
  return null
}

const AUTH_SESSION_STALE_MS = 5 * 60 * 1000

/** Single source of truth for the client session query — shell/bootstrap seed here to avoid duplicate “loading” with GET /api/auth/session. */
export const BRAIK_AUTH_SESSION_QUERY_KEY = ["braik-auth-session"] as const

/**
 * If React Query has no session yet, seed from dashboard/AD shell payloads so children don’t block on
 * `/api/auth/session` while that request still runs. Full session replaces this when the fetch completes.
 */
export function seedAuthSessionCacheFromShellUser(
  queryClient: QueryClient,
  user: SessionResponse["user"]
): void {
  queryClient.setQueryData(BRAIK_AUTH_SESSION_QUERY_KEY, (prev: SessionResponse | undefined) => {
    if (prev?.user?.id) return prev
    authTimingClient("session_query_seeded_from_shell", { userId: user.id })
    return { user }
  })
}

/**
 * Fetches session from /api/auth/session. Retries once on 5xx or network failure
 * so temporary server errors don't make the app think the user is logged out.
 * Only 401 or explicit 200 with user: null are treated as "no session".
 * Concurrent callers share one in-flight request (singleflight).
 */
export async function getSession(): Promise<SessionResponse | null> {
  if (sessionFetchInFlight) return sessionFetchInFlight
  sessionFetchInFlight = fetchSessionOnce().finally(() => {
    sessionFetchInFlight = null
  })
  return sessionFetchInFlight
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider")
  }
  return ctx
}

/**
 * Full client session from GET `/api/auth/session` (initial load + visibility/native unlock refresh).
 * Still needed for: global auth boundary (login/logout), fields not on app bootstrap (`defaultAppPath`,
 * `adminRole`, `positionGroups`, etc.), and `refetch()` after secure flows.
 *
 * In the team dashboard shell, prefer `useDashboardShellIdentity` + `AppBootstrapProvider` for routine
 * id/email/role/team/unread display — do not depend on session alone for that UI when bootstrap is mounted.
 *
 * Session is cached with React Query (`staleTime` 5m, no refetch on window focus) to avoid duplicate
 * `/api/auth/session` calls on dashboard navigation. Native biometric unlock still invalidates the query.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window === "undefined") return
    const onLoginSeed = (e: Event) => {
      const ce = e as CustomEvent<SessionResponse>
      if (ce.detail?.user?.id) {
        authTimingClient("session_query_seeded_from_login", { userId: ce.detail.user.id })
        queryClient.setQueryData(BRAIK_AUTH_SESSION_QUERY_KEY, ce.detail)
      }
    }
    window.addEventListener(BRAIK_AUTH_LOGIN_SESSION_EVENT, onLoginSeed as EventListener)
    return () => window.removeEventListener(BRAIK_AUTH_LOGIN_SESSION_EVENT, onLoginSeed as EventListener)
  }, [queryClient])

  const query = useQuery({
    queryKey: BRAIK_AUTH_SESSION_QUERY_KEY,
    queryFn: getSession,
    staleTime: AUTH_SESSION_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
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

