"use client"

import { useSession } from "@/lib/auth/client-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

/**
 * Football Directors land on /dashboard/director (gateway) before the team dashboard.
 * Eligibility: GET /api/me/director-hub. Visiting /dashboard without ?teamId= triggers redirect for eligible users.
 * With ?teamId=, skip redirect so team portal works; use header "Director View" to return to the gateway.
 */
export function DirectorHubLandingGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const teamId = searchParams.get("teamId")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setReady(true)
      return
    }
    // Portal role remains HEAD_COACH for varsity HC / Director; hub API decides Director eligibility.
    if (session?.user?.role?.toUpperCase() !== "HEAD_COACH") {
      setReady(true)
      return
    }
    if (teamId) {
      setReady(true)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/me/director-hub")
        if (!res.ok) {
          if (!cancelled) setReady(true)
          return
        }
        const data = (await res.json()) as { eligible?: boolean }
        if (!cancelled && data.eligible) {
          router.replace("/dashboard/director")
          return
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [status, session, teamId, router])

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent"
          aria-hidden
        />
      </div>
    )
  }

  return <>{children}</>
}
