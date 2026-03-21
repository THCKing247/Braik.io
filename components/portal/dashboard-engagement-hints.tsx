"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "@/lib/auth/client-auth"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Hint = {
  id: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}

const COACH_ROLES = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])

function storageKey(teamId: string, hintId: string) {
  return `braik_hint_dismissed:${teamId}:${hintId}`
}

/**
 * Single dismissible setup nudge for coaches on the main dashboard only.
 */
export function DashboardEngagementHints({ currentTeamId }: { currentTeamId: string }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [hints, setHints] = useState<Hint[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissTick, setDismissTick] = useState(0)

  const showStrip = pathname === "/dashboard" && currentTeamId && COACH_ROLES.has(session?.user?.role ?? "")

  const load = useCallback(async () => {
    if (!currentTeamId || !showStrip) return
    setLoading(true)
    try {
      const res = await fetch(`/api/engagement/hints?teamId=${encodeURIComponent(currentTeamId)}`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.hints)) {
        setHints(data.hints as Hint[])
      }
    } catch {
      setHints([])
    } finally {
      setLoading(false)
    }
  }, [currentTeamId, showStrip])

  useEffect(() => {
    void load()
  }, [load])

  const nextHint = useMemo(() => {
    for (const h of hints) {
      if (typeof window === "undefined") continue
      if (window.localStorage.getItem(storageKey(currentTeamId, h.id))) continue
      return h
    }
    return null
  }, [hints, currentTeamId, dismissTick])

  const dismiss = () => {
    if (!nextHint || !currentTeamId) return
    try {
      window.localStorage.setItem(storageKey(currentTeamId, nextHint.id), "1")
    } catch {
      /* ignore */
    }
    setDismissTick((t) => t + 1)
  }

  if (!showStrip || loading || !nextHint) {
    return null
  }

  return (
    <div
      className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:mb-0 lg:mt-0"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{nextHint.title}</p>
        <p className="text-xs text-muted-foreground">{nextHint.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm" variant="default" className="bg-primary text-primary-foreground">
          <Link href={nextHint.ctaHref}>{nextHint.ctaLabel}</Link>
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={dismiss} aria-label="Dismiss hint">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
