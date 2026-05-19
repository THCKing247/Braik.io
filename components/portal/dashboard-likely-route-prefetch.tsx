"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePortalShellKind } from "@/components/portal/portal-shell-context"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import {
  portalPrefixedDashboardHref,
  teamScopedDashboardHref,
} from "@/lib/portal/dashboard-path"
import { shouldSkipDashboardRouterPrefetch } from "@/lib/navigation/dashboard-schedule-prefetch"

type PrefetchTeam = {
  id: string
  shortOrgId?: string | null
  shortTeamId?: string | null
}

function runWhenIdle(fn: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(() => fn())
  } else {
    setTimeout(fn, 1)
  }
}

/**
 * Next `<Link prefetch>` is disabled for heavy dashboard paths (`prefetchPropForDashboardScheduleHref`).
 * After shell paint, prefetch likely navigation targets on idle so transitions stay warm without blocking.
 * See PERFORMANCE_GUIDELINES.md / DASHBOARD_DATA_OWNERSHIP.md.
 */
export function DashboardLikelyRoutePrefetch({
  teams,
  currentTeamId,
}: {
  teams: PrefetchTeam[]
  currentTeamId: string
}) {
  const router = useRouter()
  const kind = usePortalShellKind()
  const identity = useDashboardShellIdentity()
  const role = identity.roleUpper

  useEffect(() => {
    if (kind === "recruiter") {
      runWhenIdle(() => {
        router.prefetch(portalPrefixedDashboardHref("recruiter", "/"))
        router.prefetch(portalPrefixedDashboardHref("recruiter", "/messages"))
        router.prefetch(portalPrefixedDashboardHref("recruiter", "/profile"))
      })
      return
    }

    if (kind !== "coach") return

    const coachLike = role === "HEAD_COACH" || role === "ASSISTANT_COACH"
    if (!coachLike) return

    const tid = (currentTeamId || teams[0]?.id || "").trim()
    if (!tid) return

    const team = teams.find((t) => t.id === tid) ?? teams[0]
    if (!team) return

    const shortIds =
      team.shortOrgId && team.shortTeamId
        ? { shortOrgId: team.shortOrgId, shortTeamId: team.shortTeamId }
        : null

    runWhenIdle(() => {
      for (const href of [
        teamScopedDashboardHref("coach", "/roster", shortIds),
        teamScopedDashboardHref("coach", "/schedule", shortIds),
        teamScopedDashboardHref("coach", "/messages", shortIds),
      ]) {
        if (!shouldSkipDashboardRouterPrefetch(href)) {
          router.prefetch(href)
        }
      }
    })
  }, [router, kind, role, teams, currentTeamId])

  return null
}

export function AdPortalLikelyRoutePrefetch({ enabled }: { enabled: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return
    runWhenIdle(() => {
      router.prefetch("/dashboard/ad/teams")
      router.prefetch("/dashboard/ad/coaches")
    })
  }, [enabled, router])

  return null
}
