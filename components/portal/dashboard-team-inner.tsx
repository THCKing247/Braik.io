"use client"

import { Suspense, useEffect, useMemo, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "@/lib/auth/client-auth"
import { PortalTeamProvider, useEffectiveTeamId } from "@/components/portal/portal-team-context"
import { AppBootstrapProvider } from "@/components/portal/app-bootstrap-context"
import { MessagingUnreadProvider } from "@/components/portal/messaging-unread-context"
import { AdPortalLinkProvider } from "@/components/portal/ad-portal-link-context"
import { rememberActiveDashboardTeam } from "@/lib/dashboard/active-team-session"
import { devDashboardHandoffLog } from "@/lib/debug/dashboard-handoff-dev"
import { LoadingState } from "@/components/ui/loading-state"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

function UrlResolvedTeamBootstrap({ teams, children }: { teams: Team[]; children: ReactNode }) {
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const urlTeamId = searchParams.get("teamId")
  const effective = useEffectiveTeamId(urlTeamId, session?.user?.teamId)
  /**
   * MUST match `DashboardPageShell`: `effectiveTeamId || teamIdFromQuery || ""`, then shell fallbacks.
   * Previously we used `(effective || teams[0])` only — missing `urlTeamId` caused AppBootstrap to bind to
   * `teams[0]` while the page passed `?teamId=` to children → two React Query keys, network OK for one, skeleton forever on the other.
   */
  const tid = (effective.trim() || urlTeamId?.trim() || teams[0]?.id || "").trim()

  useEffect(() => {
    if (tid) rememberActiveDashboardTeam(tid)
  }, [tid])

  const shellTeamIdsSig = teams.map((t) => t.id).join(",")
  useEffect(() => {
    devDashboardHandoffLog("UrlResolvedTeamBootstrap", {
      urlTeamId,
      effectiveFromContext: effective.trim(),
      resolvedAppBootstrapTeamId: tid,
      shellTeamIds: shellTeamIdsSig,
    })
  }, [urlTeamId, effective, tid, shellTeamIdsSig])

  return (
    <AdPortalLinkProvider>
      <AppBootstrapProvider teamId={tid}>
        <MessagingUnreadProvider>{children}</MessagingUnreadProvider>
      </AppBootstrapProvider>
    </AdPortalLinkProvider>
  )
}

/**
 * Portal team list + URL-aligned app bootstrap (matches DashboardPageShell / team switcher).
 * Must render under Suspense (useSearchParams).
 */
export function DashboardTeamInner({
  teams,
  serverCurrentTeamId,
  children,
}: {
  teams: Team[]
  serverCurrentTeamId: string
  children: ReactNode
}) {
  const searchParams = useSearchParams()
  const shellTeamIds = teams.map((t) => t.id)
  const validTeamIds = useMemo(() => new Set(shellTeamIds), [shellTeamIds])
  const serverResolved = serverCurrentTeamId.trim() || teams[0]?.id || ""
  /** Client navigation (e.g. AD portal → /dashboard?teamId=…) — URL must win over server-resolved default. */
  const urlTeamId = searchParams.get("teamId")
  const currentTeamIdForPortal =
    urlTeamId && validTeamIds.has(urlTeamId) ? urlTeamId : serverResolved

  return (
    <PortalTeamProvider teamIds={shellTeamIds} currentTeamId={currentTeamIdForPortal}>
      <UrlResolvedTeamBootstrap teams={teams}>{children}</UrlResolvedTeamBootstrap>
    </PortalTeamProvider>
  )
}

const shellSuspenseFallback = (
  <div className="flex min-h-screen flex-col bg-background">
    <div
      className="min-h-[52px] w-full shrink-0 border-b border-border bg-card pt-[env(safe-area-inset-top,0px)]"
      style={{ minHeight: "max(52px, calc(52px + env(safe-area-inset-top, 0px)))" }}
    />
    <LoadingState label="Loading dashboard" minHeightClassName="min-h-[40vh]" className="flex-1 p-6" size="lg" />
  </div>
)

export function DashboardTeamScopeSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={shellSuspenseFallback}>{children}</Suspense>
}
