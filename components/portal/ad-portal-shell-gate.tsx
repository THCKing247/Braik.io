"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect, useMemo, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { getDefaultAppPathForRole, seedAuthSessionCacheFromShellUser, useSession } from "@/lib/auth/client-auth"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import { createPendingAdPortalBootstrapPayload } from "@/lib/app/ad-portal-bootstrap-placeholder"
import {
  isAdPortalBootstrapForbiddenError,
  isAdPortalBootstrapUnauthorizedError,
  useAdPortalBootstrapQuery,
} from "@/lib/app/ad-portal-bootstrap-query"
import { AdAppBootstrapProvider } from "@/components/portal/ad-app-bootstrap-context"
import { AdNav, AdNavShellSkeleton } from "@/components/portal/ad/ad-nav"
import {
  AD_TEAMS_TABLE_GC_MS,
  AD_TEAMS_TABLE_QUERY_KEY,
  AD_TEAMS_TABLE_STALE_MS,
  fetchAdTeamsTableQuery,
} from "@/lib/ad/ad-teams-table-query"

export function AdPortalShellGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const session = useSession()
  const q = useAdPortalBootstrapQuery()
  const pendingSinceRef = useRef<number | null>(null)
  const loggedReadyMs = useRef(false)

  const authRedirectError =
    q.isError &&
    q.error &&
    (isAdPortalBootstrapUnauthorizedError(q.error) || isAdPortalBootstrapForbiddenError(q.error))

  const placeholderPayload = useMemo((): AppAdPortalBootstrapPayload => {
    const u = session.data?.user
    return createPendingAdPortalBootstrapPayload({
      id: u?.id ?? "",
      email: u?.email ?? "",
      role: u?.role,
      name: u?.name ?? null,
      isPlatformOwner: u?.isPlatformOwner,
    })
  }, [session.data?.user?.id, session.data?.user?.email, session.data?.user?.role, session.data?.user?.name, session.data?.user?.isPlatformOwner])

  const mergedPayload: AppAdPortalBootstrapPayload = q.data ?? placeholderPayload
  const bootstrapReady = Boolean(q.data)
  const showRealNav = bootstrapReady && !authRedirectError

  useEffect(() => {
    authTimingClient("ad_portal_shell_gate_layout_mounted", { pathname })
  }, [pathname])

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard/ad")) return
    if (!session.data?.user?.id) return
    void queryClient.prefetchQuery({
      queryKey: AD_TEAMS_TABLE_QUERY_KEY,
      queryFn: () => fetchAdTeamsTableQuery(),
      staleTime: AD_TEAMS_TABLE_STALE_MS,
      gcTime: AD_TEAMS_TABLE_GC_MS,
    })
  }, [pathname, queryClient, session.data?.user?.id])

  useEffect(() => {
    if (q.isPending && !q.data && pendingSinceRef.current === null) {
      pendingSinceRef.current = typeof performance !== "undefined" ? performance.now() : 0
    }
    if (q.data && pendingSinceRef.current !== null && !loggedReadyMs.current) {
      loggedReadyMs.current = true
      const ms =
        typeof performance !== "undefined" ? Math.round(performance.now() - pendingSinceRef.current) : 0
      authTimingClient("ad_portal_shell_gate_bootstrap_ready_ms", { ms, fromCache: !q.isFetching })
    }
  }, [q.isPending, q.data, q.isFetching])

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

  useEffect(() => {
    if (bootstrapReady && q.dataUpdatedAt) {
      authTimingClient("ad_portal_bootstrap_gate_ready", {
        fromCache: Boolean(q.data) && !q.isFetching,
      })
    }
  }, [bootstrapReady, q.dataUpdatedAt, q.data, q.isFetching])

  if (authRedirectError) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <div className="h-14 animate-pulse border-b border-[#E5E7EB] bg-white/60" aria-hidden />
      </div>
    )
  }

  if (q.isError && !authRedirectError) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <p className="text-[#212529]">Could not load the Athletic Director portal. Please refresh or try again later.</p>
      </div>
    )
  }

  return (
    <AdAppBootstrapProvider initialPayload={mergedPayload}>
      <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
        {showRealNav ? <AdNav /> : <AdNavShellSkeleton />}
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </div>
    </AdAppBootstrapProvider>
  )
}
