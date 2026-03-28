"use client"

import { Suspense, useEffect, useMemo, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "@/lib/auth/client-auth"
import { PortalTeamProvider, useEffectiveTeamId } from "@/components/portal/portal-team-context"
import { AppBootstrapProvider } from "@/components/portal/app-bootstrap-context"
import { AdPortalLinkProvider } from "@/components/portal/ad-portal-link-context"
import { rememberActiveDashboardTeam } from "@/lib/dashboard/active-team-session"

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
  const tid = (effective.trim() || teams[0]?.id || "").trim()

  useEffect(() => {
    if (tid) rememberActiveDashboardTeam(tid)
  }, [tid])

  return (
    <AdPortalLinkProvider>
      <AppBootstrapProvider teamId={tid}>{children}</AppBootstrapProvider>
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
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
    </div>
  </div>
)

export function DashboardTeamScopeSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={shellSuspenseFallback}>{children}</Suspense>
}
