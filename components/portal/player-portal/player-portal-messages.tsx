"use client"

import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"
import { MessagingManager } from "@/components/portal/messaging-manager"
import { PortalStandardPageRoot } from "@/components/portal/portal-standard-page"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"

/**
 * Player messaging uses the signed-in athlete identity (`userId` from shell) — never a parent account.
 */
export function PlayerPortalMessages({ routeThreadId }: { routeThreadId?: string | null }) {
  const { teamId, userId } = usePlayerPortal()
  const dashQ = useDashboardBootstrapQuery(teamId)
  const bootstrapCoreReady = dashQ.data ? dashQ.data.deferredPending === false : false
  const bootstrapThreadsInbox = bootstrapCoreReady ? dashQ.data?.messageThreadsInbox : undefined

  return (
    <div className="flex min-h-[min(720px,calc(100dvh-13rem))] flex-1 flex-col overflow-hidden rounded-2xl border border-white/40 bg-white shadow-xl">
      <PortalStandardPageRoot className="flex min-h-0 flex-1 flex-col !space-y-0 overflow-hidden pb-0">
        <MessagingManager
          teamId={teamId}
          userRole="PLAYER"
          userId={userId}
          bootstrapThreadsInbox={bootstrapThreadsInbox}
          bootstrapCoreReady={bootstrapCoreReady}
          routeThreadId={routeThreadId ?? undefined}
        />
      </PortalStandardPageRoot>
    </div>
  )
}
