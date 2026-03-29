"use client"

import { Suspense, useEffect } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { useSearchParams } from "next/navigation"
import { ConnectToTeam } from "@/components/portal/connect-to-team"
import { useEffectiveTeamId } from "@/components/portal/portal-team-context"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import { devDashboardHandoffLog } from "@/lib/debug/dashboard-handoff-dev"

/** Pulse placeholders while search params / session hydrate — avoids a full-page spinner. */
export function DashboardPageShellSkeleton() {
  return (
    <div className="min-w-0 space-y-4 px-4 pb-4 pt-2 md:space-y-6 md:px-6" aria-busy="true" aria-label="Loading page">
      <div className="h-9 w-44 animate-pulse rounded-md bg-[rgb(var(--platinum))]" />
      <div className="h-32 w-full animate-pulse rounded-xl bg-[rgb(var(--platinum))] md:rounded-lg" />
      <div className="h-40 w-full animate-pulse rounded-xl bg-[rgb(var(--platinum))] md:rounded-lg" />
    </div>
  )
}

/**
 * Internal component that uses useSearchParams - must be wrapped in Suspense
 */
function DashboardPageShellContent({
  children,
  requireTeam = true,
}: {
  children: (props: { teamId: string; userRole: string; userId: string; canEdit: boolean }) => React.ReactNode
  requireTeam?: boolean
}) {
  const identity = useDashboardShellIdentity()
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const teamIdFromQuery = searchParams.get("teamId")
  const sessionTeamHint = identity.sessionUser?.teamId
  const effectiveTeamId = useEffectiveTeamId(teamIdFromQuery, sessionTeamHint)
  // Use only context-resolved or URL teamId; never fall back to session.teamId so we never send a stale/deleted team id to APIs
  const teamId = effectiveTeamId || teamIdFromQuery || ""
  const userRole = identity.roleUpper

  useEffect(() => {
    devDashboardHandoffLog("DashboardPageShell", {
      teamIdFromQuery,
      effectiveTeamId,
      resolvedPageTeamId: teamId,
    })
  }, [teamIdFromQuery, effectiveTeamId, teamId])
  const userId = identity.userId
  const canEdit = userRole === "HEAD_COACH" || userRole === "ASSISTANT_COACH"

  /** Prefer shell/bootstrap identity; do not block the whole shell on session query if user id is already known. */
  const sessionStillLoading = !identity.hasIdentity && status === "loading" && !session?.user?.id

  if (sessionStillLoading) {
    return <DashboardPageShellSkeleton />
  }

  if (!identity.hasIdentity) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm" style={{ borderColor: "rgb(var(--border))" }}>
          <h2 className="text-base font-semibold" style={{ color: "rgb(var(--text))" }}>Session data is incomplete</h2>
          <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
            This can happen after a temporary connection issue. Refresh the page to try again, or sign out and back in if it persists.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
          >
            Refresh page
          </button>
        </div>
      </div>
    )
  }

  if (requireTeam && !teamId) {
    return <ConnectToTeam role={userRole} />
  }

  return (
    <>
      {identity.bootstrapLoading && identity.hasIdentity ? (
        <div
          className="mb-2 flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-center text-xs"
          style={{
            borderColor: "rgb(var(--border))",
            backgroundColor: "rgb(var(--platinum))",
            color: "rgb(var(--muted))",
          }}
          role="status"
        >
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[rgb(var(--accent))] border-t-transparent" aria-hidden />
          Refreshing team menu and badges…
        </div>
      ) : null}
      {children({ teamId, userRole, userId, canEdit })}
    </>
  )
}

/**
 * Resolves teamId and session for dashboard child pages.
 * Shows loading or ConnectToTeam when needed; otherwise renders children with resolved props.
 * Wraps content in Suspense to handle useSearchParams() requirement.
 */
export function DashboardPageShell({
  children,
  requireTeam = true,
}: {
  children: (props: { teamId: string; userRole: string; userId: string; canEdit: boolean }) => React.ReactNode
  requireTeam?: boolean
}) {
  return (
    <Suspense fallback={<DashboardPageShellSkeleton />}>
      <DashboardPageShellContent requireTeam={requireTeam}>
        {children}
      </DashboardPageShellContent>
    </Suspense>
  )
}
