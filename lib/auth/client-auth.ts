"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"

const AUTH_DEBUG = typeof window !== "undefined" && (window as unknown as { __BRAIK_DEBUG_AUTH?: boolean }).__BRAIK_DEBUG_AUTH === true

function authLog(event: string, detail?: Record<string, unknown>) {
  if (AUTH_DEBUG && typeof console !== "undefined") {
    console.info("[auth]", event, detail ?? "")
  }
}

type SessionResponse = {
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
  }
}

type SignInOptions = {
  email?: string
  password?: string
  callbackUrl?: string
  redirect?: boolean
  rememberMe?: boolean
}

function getRedirectFromRole(role?: string) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "/admin/dashboard"
    case "head_coach":
    case "assistant_coach":
    case "player":
    case "parent":
    case "athlete":
      return "/dashboard"
    default:
      return "/dashboard"
  }
}

export async function signIn(provider: string, options: SignInOptions = {}) {
  if (provider !== "credentials") {
    return { ok: false, status: 400, error: "UnsupportedProvider" }
  }

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
  }
  const callbackUrl = options.callbackUrl || data.redirectTo || getRedirectFromRole(data.role)
  const isSuccess = response.ok && data.success === true

  if (isSuccess) {
    authLog("SIGNED_IN", { redirectTo: callbackUrl })
    if (options.redirect !== false) {
      window.location.href = callbackUrl
    }
    return { ok: true, status: response.status, error: undefined, url: callbackUrl }
  }

  return { ok: false, status: response.status, error: data.error || "CredentialsSignin" }
}

export async function signOut(options: { callbackUrl?: string } = {}) {
  authLog("SIGNED_OUT", { reason: "user_initiated" })
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
  const callbackUrl = options.callbackUrl || "/"
  window.location.href = callbackUrl
}

const SESSION_RETRY_DELAY_MS = 800
const SESSION_MAX_RETRIES = 1

/**
 * Fetches session from /api/auth/session. Retries once on 5xx or network failure
 * so temporary server errors don't make the app think the user is logged out.
 * Only 401 or explicit 200 with user: null are treated as "no session".
 */
export async function getSession(): Promise<SessionResponse | null> {
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
        if (hasUser) return data as SessionResponse
        return null
      }

      if (response.status === 401) {
        authLog("SESSION_401", { attempt: attempt + 1 })
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

export function useSession() {
  const [data, setData] = useState<SessionResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getSession()
      .then((session) => {
        if (active) setData(session)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return useMemo(
    () => ({
      data,
      status: loading ? "loading" : data ? "authenticated" : "unauthenticated",
    }),
    [data, loading]
  )
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return children
}

