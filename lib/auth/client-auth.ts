"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"

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
}

function getRedirectFromRole(role?: string) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "/admin/dashboard"
    case "head_coach":
    case "assistant_coach":
    case "player":
    case "parent":
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
    if (options.redirect !== false) {
      window.location.href = callbackUrl
    }
    return { ok: true, status: response.status, error: undefined, url: callbackUrl }
  }

  return { ok: false, status: response.status, error: data.error || "CredentialsSignin" }
}

export async function signOut(options: { callbackUrl?: string } = {}) {
  await fetch("/api/auth/logout", { method: "POST" })
  const callbackUrl = options.callbackUrl || "/"
  window.location.href = callbackUrl
}

export async function getSession(): Promise<SessionResponse | null> {
  const response = await fetch("/api/auth/session", { cache: "no-store" })
  if (!response.ok) {
    return null
  }
  return (await response.json()) as SessionResponse
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

