"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  useDashboardShellQuery,
  isDashboardShellUnauthorizedError,
} from "@/lib/dashboard/dashboard-shell-query"
import type { DashboardShellPayload } from "@/lib/dashboard/dashboard-shell-payload"
import { DashboardShellLoadingSkeleton } from "@/components/portal/dashboard-shell-loading-skeleton"
import { DashboardLayoutFallback } from "@/components/portal/dashboard-layout-fallback"
import { FreePortalRouteEnforcer } from "@/components/portal/free-portal-route-enforcer"
import { normalizePlayerAccountIdSegment } from "@/lib/roster/resolve-roster-player-segment"

export function ParentPortalShellGate({
  urlLinkSegment,
  children,
}: {
  urlLinkSegment: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const q = useDashboardShellQuery()

  useEffect(() => {
    if (!q.isError || !q.error) return
    if (!isDashboardShellUnauthorizedError(q.error)) return
    const dest = pathname || "/parent"
    router.replace(`/login?callbackUrl=${encodeURIComponent(dest)}`)
  }, [q.isError, q.error, router, pathname])

  useEffect(() => {
    const payload = q.data as DashboardShellPayload | undefined
    if (!payload || payload.shellMode !== "full") return
    if (payload.portalKind !== "parent") {
      router.replace(payload.user.defaultAppPath || "/dashboard")
    }
  }, [q.data, router])

  useEffect(() => {
    const payload = q.data as DashboardShellPayload | undefined
    if (!payload || payload.shellMode !== "full" || payload.portalKind !== "parent") return
    const canonical = payload.parentPortalSegment
    if (!canonical) return
    if (normalizePlayerAccountIdSegment(urlLinkSegment) !== normalizePlayerAccountIdSegment(canonical)) {
      router.replace(`/parent/${encodeURIComponent(canonical)}`)
    }
  }, [q.data, router, urlLinkSegment])

  if (q.isError && isDashboardShellUnauthorizedError(q.error)) {
    return <DashboardShellLoadingSkeleton />
  }

  if (q.isPending && !q.data) {
    return <DashboardShellLoadingSkeleton />
  }

  if (q.isError) {
    return <DashboardLayoutFallback />
  }

  const payload = q.data
  if (!payload) return <DashboardShellLoadingSkeleton />

  if (payload.shellMode !== "full") {
    return <DashboardShellLoadingSkeleton />
  }

  if (payload.portalKind !== "parent") {
    return <DashboardShellLoadingSkeleton />
  }

  const segment = payload.parentPortalSegment ?? urlLinkSegment
  const baseHref = `/parent/${encodeURIComponent(segment)}`

  const teamName =
    payload.teams.find((t) => t.id === payload.currentTeamId)?.name ??
    payload.teams[0]?.name ??
    "Team"

  return (
    <FreePortalRouteEnforcer portalKind="parent" portalBaseHref={baseHref}>
      <div className="flex min-h-screen flex-col bg-[#faf8f5]">
        <header className="sticky top-0 z-30 border-b border-amber-200/80 bg-white shadow-sm">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Parent</p>
              <p className="truncate text-lg font-semibold text-slate-900">{teamName}</p>
            </div>
            <nav className="flex shrink-0 flex-wrap gap-2 text-sm">
              <Link className="rounded-full px-3 py-1 text-slate-700 hover:bg-amber-50" href={baseHref}>
                Home
              </Link>
              <Link
                className="rounded-full px-3 py-1 text-slate-700 hover:bg-amber-50"
                href={`${baseHref}/messages`}
              >
                Messages
              </Link>
              <Link
                className="rounded-full px-3 py-1 text-slate-700 hover:bg-amber-50"
                href={`${baseHref}/calendar`}
              >
                Calendar
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      </div>
    </FreePortalRouteEnforcer>
  )
}
