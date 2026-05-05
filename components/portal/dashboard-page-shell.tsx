"use client"

import { Suspense, useEffect } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { useSearchParams, useRouter } from "next/navigation"
import { ConnectToTeam } from "@/components/portal/connect-to-team"
import { useEffectiveTeamId } from "@/components/portal/portal-team-context"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import { devDashboardHandoffLog } from "@/lib/debug/dashboard-handoff-dev"
import { LoadingState } from "@/components/ui/loading-state"
import { AppLoader } from "@/components/ui/app-loader"

export function DashboardPageShellSkeleton() {
  return <LoadingState label="Loading page" className="px-4 pb-4 pt-2 md:px-6" minHeightClassName="min-h-[36vh]" size="lg" />
}

function DashboardPageShellContent({ children, requireTeam = true }) {
  const identity = useDashboardShellIdentity()
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const teamIdFromQuery = searchParams.get("teamId")
  const sessionTeamHint = identity.sessionUser?.teamId
  const effectiveTeamId = useEffectiveTeamId(teamIdFromQuery, sessionTeamHint)
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

  const sessionStillLoading = !identity.hasIdentity && status === "loading" && !session?.user?.id

  if (sessionStillLoading) {
    return <DashboardPageShellSkeleton />
  }

  if (!identity.hasIdentity) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold">Session data is incomplete</h2>
          <p className="mt-2 text-sm">
            This can happen after a temporary connection issue. Refresh the page to try again.
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 rounded-md border px-3 py-2 text-sm font-medium"
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
        <div className="mb-2 flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-xs" role="status">
          <AppLoader size="sm" label="Refreshing team data" />
          Refreshing team menu and badges…
        </div>
      ) : null}
      {children({ teamId, userRole, userId, canEdit })}
    </>
  )
}

export function DashboardPageShell({ children, requireTeam = true }) {
  return (
    <Suspense fallback={<DashboardPageShellSkeleton />}>
      <DashboardPageShellContent requireTeam={requireTeam}>
        {children}
      </DashboardPageShellContent>
    </Suspense>
  )
}
