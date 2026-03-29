"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { getDefaultAppPathForRole, seedAuthSessionCacheFromShellUser } from "@/lib/auth/client-auth"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import {
  isAdPortalBootstrapForbiddenError,
  isAdPortalBootstrapUnauthorizedError,
  useAdPortalBootstrapQuery,
} from "@/lib/app/ad-portal-bootstrap-query"
import { AdAppBootstrapProvider } from "@/components/portal/ad-app-bootstrap-context"
import { AdNav } from "@/components/portal/ad/ad-nav"

type Phase = "loading" | "error" | "ready"

function AdPortalShellSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
      <div className="h-14 animate-pulse border-b border-[#E5E7EB] bg-white/60" aria-hidden />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="h-8 w-56 animate-pulse rounded bg-[#E5E7EB]" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-[#F3F4F6]" />
      </main>
    </div>
  )
}

export function AdPortalShellGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const q = useAdPortalBootstrapQuery()

  useEffect(() => {
    if (!q.isError || !q.error) return
    if (isAdPortalBootstrapUnauthorizedError(q.error)) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/dashboard/ad")}`)
      return
    }
    if (isAdPortalBootstrapForbiddenError(q.error)) {
      router.replace("/dashboard")
    }
  }, [q.isError, q.error, router, pathname])

  useEffect(() => {
    const json = q.data as AppAdPortalBootstrapPayload | undefined
    if (!json?.user?.id) return
    const u = json.user
    seedAuthSessionCacheFromShellUser(queryClient, {
      id: u.id,
      email: u.email,
      name: u.displayName,
      role: u.role,
      teamId: u.teamId,
      isPlatformOwner: u.isPlatformOwner,
      defaultAppPath: getDefaultAppPathForRole(u.role),
    })
  }, [q.data, queryClient])

  const authRedirectError =
    q.isError &&
    q.error &&
    (isAdPortalBootstrapUnauthorizedError(q.error) || isAdPortalBootstrapForbiddenError(q.error))

  const phase: Phase =
    q.isPending && !q.data
      ? "loading"
      : q.isError && !authRedirectError
        ? "error"
        : q.data
          ? "ready"
          : "loading"

  useEffect(() => {
    if (phase === "ready" && q.dataUpdatedAt) {
      authTimingClient("ad_portal_bootstrap_gate_ready", {
        fromCache: Boolean(q.data) && !q.isFetching,
      })
    }
  }, [phase, q.dataUpdatedAt, q.data, q.isFetching])

  if (authRedirectError || (phase === "loading" && !q.data)) {
    return <AdPortalShellSkeleton />
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <p className="text-[#212529]">Could not load the Athletic Director portal. Please refresh or try again later.</p>
      </div>
    )
  }

  const payload = q.data
  if (!payload) {
    return <AdPortalShellSkeleton />
  }

  return (
    <AdAppBootstrapProvider initialPayload={payload}>
      <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <AdNav />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </div>
    </AdAppBootstrapProvider>
  )
}
