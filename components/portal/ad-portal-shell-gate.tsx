"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { getDefaultAppPathForRole, seedAuthSessionCacheFromShellUser } from "@/lib/auth/client-auth"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
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
  const [phase, setPhase] = useState<Phase>("loading")
  const [payload, setPayload] = useState<AppAdPortalBootstrapPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const t0 = performance.now()
      authTimingClient("ad_portal_bootstrap_fetch_start")
      try {
        const res = await fetch("/api/app/bootstrap?portal=ad", {
          credentials: "include",
          cache: "no-store",
        })
        if (res.status === 401) {
          router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/dashboard/ad")}`)
          return
        }
        if (res.status === 403) {
          router.replace("/dashboard")
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as AppAdPortalBootstrapPayload
        authTimingClient("ad_portal_bootstrap_fetch_done", { ms: Math.round(performance.now() - t0) })
        if (!cancelled && json.user?.id) {
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
        }
        if (cancelled) return
        setPayload(json)
        setPhase("ready")
      } catch (e) {
        console.error("[AdPortalShellGate]", e)
        if (!cancelled) setPhase("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, pathname, queryClient])

  if (phase === "loading" || !payload) {
    return <AdPortalShellSkeleton />
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <p className="text-[#212529]">Could not load the Athletic Director portal. Please refresh or try again later.</p>
      </div>
    )
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
