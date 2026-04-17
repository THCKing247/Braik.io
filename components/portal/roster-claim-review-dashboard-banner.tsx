"use client"

import Link from "next/link"
import { prefetchPropForDashboardScheduleHref } from "@/lib/navigation/dashboard-schedule-prefetch"
import { useEffect, useState } from "react"

/**
 * Coach dashboard strip when pending self-signups or duplicate hints exist.
 */
export function RosterClaimReviewDashboardBanner({ teamId }: { teamId: string }) {
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(0)
  const [hints, setHints] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/roster/claim-review?teamId=${encodeURIComponent(teamId)}`, { credentials: "include" })
        const data = (await res.json()) as {
          pendingReview?: unknown[]
          duplicateHints?: unknown[]
        }
        if (cancelled || !res.ok) return
        const p = Array.isArray(data.pendingReview) ? data.pendingReview.length : 0
        const h = Array.isArray(data.duplicateHints) ? data.duplicateHints.length : 0
        setPending(p)
        setHints(h)
        setShow(p + h > 0)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [teamId])

  if (!show) return null

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="text-sm text-amber-950">
        <span className="font-semibold">Roster signup:</span>{" "}
        {pending > 0 ? `${pending} pending review` : null}
        {pending > 0 && hints > 0 ? " · " : null}
        {hints > 0 ? `${hints} possible duplicate${hints === 1 ? "" : "s"}` : null}
      </p>
      <Link
        href="/dashboard/roster/review"
        prefetch={prefetchPropForDashboardScheduleHref("/dashboard/roster/review")}
        className="text-sm font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 shrink-0"
      >
        Review roster signups
      </Link>
    </div>
  )
}
