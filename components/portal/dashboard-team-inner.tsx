"use client"

import { Suspense, useEffect, useMemo, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { parseCanonicalDashboardTeamPath } from "@/lib/navigation/organization-routes"
import { useDashboardShellQuery } from "@/lib/dashboard/dashboard-shell-query"
import { PortalTeamProvider, useEffectiveTeamId } from "@/components/portal/portal-team-context"
import { AppBootstrapProvider } from "@/components/portal/app-bootstrap-context"
import { MessagingUnreadProvider } from "@/components/portal/messaging-unread-context"
import { AdPortalLinkProvider } from "@/components/portal/ad-portal-link-context"
import { rememberActiveDashboardTeam } from "@/lib/dashboard/active-team-session"
import { devDashboardHandoffLog } from "@/lib/debug/dashboard-handoff-dev"

interface Team {
  id: string
  name: string
  shortOrgId?: string | null
  shortTeamId?: string | null
  organization: { name: string }
  sport: string
  seasonName: string
}

function resolveCurrentTeamIdForPortal(args: {
  pathname: string | null
  urlTeamId: string | null
  teams: Team[]
  serverResolved: string
}): string {
  const valid = new Set(args.teams.map((t) => t.id))
  const canon = args.pathname ? parseCanonicalDashboardTeamPath(args.pathname) : null
  const fromCanon =
    canon &&
    args.teams.find((t) => t.shortOrgId === canon.shortOrgId && t.shortTeamId === canon.shortTeamId)?.id
  if (fromCanon && valid.has(fromCanon)) return fromCanon
  if (args.urlTeamId && valid.has(args.urlTeamId)) return args.urlTeamId
  if (args.serverResolved && valid.has(args.serverResolved)) return args.serverResolved
  // Degraded state: shell resolved no teams (stale team_members) but serverResolved carries
  // profiles.team_id — use it so PortalTeamContext has a non-empty currentTeamId and
  // DashboardPageShell renders the page instead of ConnectToTeam.
  return args.teams[0]?.id || args.serverResolved || ""
}

function UrlResolvedTeamBootstrap({ teams, children }: { teams: Team[]; children: ReactNode }) {
  const searchParams = useSearchParams()
  const shellQ = useDashboardShellQuery()
  const shellTeamHint =
    shellQ.data?.shellMode === "full" ? shellQ.data.user.teamId : undefined
  const urlTeamId = searchParams.get("teamId")
  /** Align with shell user.teamId so we do not wait on `useSession()` for team alignment (PERFORMANCE_GUIDELINES.md). */
  const effective = useEffectiveTeamId(urlTeamId, shellTeamHint)
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shellTeamIds = teams.map((t) => t.id)
  const validTeamIds = useMemo(() => new Set(shellTeamIds), [shellTeamIds])
  const serverTrim = serverCurrentTeamId.trim()
  // When no teams are in the valid set (degraded: stale team_members, valid profiles.team_id),
  // bypass the has() check so the profile team ID passes through as serverResolved.
  const serverResolved =
    serverTrim && (validTeamIds.has(serverTrim) || validTeamIds.size === 0)
      ? serverTrim
      : teams[0]?.id || ""
  /** Client navigation (e.g. AD portal → /dashboard?teamId=…) — URL must win over server-resolved default. */
  const urlTeamId = searchParams.get("teamId")
  const currentTeamIdForPortal = resolveCurrentTeamIdForPortal({
    pathname,
    urlTeamId,
    teams,
    serverResolved,
  })

  return (
    <PortalTeamProvider teams={teams} currentTeamId={currentTeamIdForPortal}>
      <UrlResolvedTeamBootstrap teams={teams}>{children}</UrlResolvedTeamBootstrap>
    </PortalTeamProvider>
  )
}

/** Suspense for team bootstrap only — chrome is usually already visible from the shell gate; keep fallback compact. */
const shellSuspenseFallback = (
  <div
    className="flex min-h-[30vh] flex-col bg-background px-4 pb-6 pt-4 md:px-6"
    aria-busy
    aria-label="Loading team scope"
  >
    <div className="mb-4 h-9 max-w-sm animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
    <div className="h-32 w-full animate-pulse rounded-xl bg-[rgb(var(--platinum))]" />
  </div>
)

export function DashboardTeamScopeSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={shellSuspenseFallback}>{children}</Suspense>
}
