"use client"

import { useSession } from "@/lib/auth/client-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

/**
 * Football Directors (program_members.director_of_football, or legacy eligible HC) land on
 * /dashboard/director first. Eligibility comes from GET /api/me/director-hub (server truth), not session alone.
 * Visiting /dashboard with ?teamId= skips redirect (operational team context).
 * Sidebar / logo should prefer /dashboard?teamId=… so "home" does not loop back to the hub.
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
