"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { seedAuthSessionCacheFromShellUser } from "@/lib/auth/client-auth"
import type { DashboardShellPayload } from "@/lib/dashboard/dashboard-shell-payload"
import { DashboardNav } from "@/components/portal/dashboard-nav"
import { SubscriptionGuard } from "@/components/portal/subscription-guard"
import { DashboardLayoutClient } from "@/components/portal/dashboard-layout-client"
import { DashboardShellWithMobileNav } from "@/components/portal/dashboard-shell-with-mobile-nav"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { CoachPageDebug } from "@/components/portal/coach-page-debug"
import { DashboardLayoutFallback } from "@/components/portal/dashboard-layout-fallback"
import { DashboardShellLoadingSkeleton } from "@/components/portal/dashboard-shell-loading-skeleton"
import { authTimingClient } from "@/lib/auth/login-flow-timing"

type GateState = "loading" | "error" | "ready"

export function DashboardTeamShellGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [state, setState] = useState<GateState>("loading")
  const [payload, setPayload] = useState<DashboardShellPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const t0 = performance.now()
      authTimingClient("dashboard_shell_fetch_start", { path: pathname })
      try {
        const res = await fetch("/api/dashboard/shell", { credentials: "include", cache: "no-store" })
        if (res.status === 401) {
          const dest = pathname || "/dashboard"
          router.replace(`/login?callbackUrl=${encodeURIComponent(dest)}`)
          return
        }
        if (!res.ok) {
          throw new Error(`shell ${res.status}`)
        }
        const json = (await res.json()) as DashboardShellPayload
        authTimingClient("dashboard_shell_fetch_done", {
          ms: Math.round(performance.now() - t0),
          shellMode: json.shellMode,
        })
        if (!cancelled && json.user?.id) {
          seedAuthSessionCacheFromShellUser(queryClient, json.user)
        }
        if (cancelled) return
        setPayload(json)
        setState("ready")
      } catch (err) {
        console.error("[DashboardTeamShellGate] shell fetch failed:", err)
        if (!cancelled) setState("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, pathname, queryClient])

  useEffect(() => {
    if (!payload || payload.shellMode !== "full") return
    const layoutUserRole = payload.user.role?.toUpperCase()
    if (
      payload.teams.length === 0 &&
      layoutUserRole === "HEAD_COACH" &&
      !payload.user.isPlatformOwner
    ) {
      router.replace("/onboarding")
    }
  }, [payload, router])

  if (state === "loading" || !payload) {
    return <DashboardShellLoadingSkeleton />
  }

  if (state === "error") {
    return <DashboardLayoutFallback />
  }

  if (payload.shellMode === "ad-delegate") {
    return <>{children}</>
  }

  const {
    user,
    teams,
    currentTeamId,
    impersonation,
    subscriptionPaid,
    remainingBalance,
    currentTeamStatus,
  } = payload

  const layoutUserRole = user.role?.toUpperCase()
  if (
    teams.length === 0 &&
    layoutUserRole === "HEAD_COACH" &&
    !user.isPlatformOwner
  ) {
    return <DashboardShellLoadingSkeleton />
  }

  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]

  return (
    <DashboardShellWithMobileNav teams={teams} currentTeamId={currentTeamId}>
      <div className="app-shell flex min-h-screen flex-col bg-background">
        <header className="shrink-0">
          <DashboardNav teams={teams} />
        </header>
        <DashboardLayoutClient teams={teams} currentTeamId={currentTeamId} className="flex w-full min-w-0 flex-col">
          {process.env.NODE_ENV === "development" ? (
            <CoachPageDebug session={{ user }} teamIds={teams.map((t) => t.id)} accessAllowed={true} />
          ) : null}
          {impersonation ? <ImpersonationBanner /> : null}
          <SuspensionBanner teamStatus={currentTeamStatus ?? currentTeam?.teamStatus} role={user.role} />
          <SubscriptionGuard subscriptionPaid={subscriptionPaid} remainingBalance={remainingBalance}>
            {children}
          </SubscriptionGuard>
        </DashboardLayoutClient>
      </div>
    </DashboardShellWithMobileNav>
  )
}
