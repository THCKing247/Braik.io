"use client"

import { useMemo } from "react"
import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"
import { MessagingManager } from "@/components/portal/messaging-manager"
import { PortalStandardPageRoot } from "@/components/portal/portal-standard-page"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"

/**
 * Player messaging uses the signed-in athlete identity (`userId` from shell) — never a parent account.
 */
export function PlayerPortalMessages({ routeThreadId }: { routeThreadId?: string | null }) {
  const { teamId, userId, accountSegment } = usePlayerPortal()
  const dashQ = useDashboardBootstrapQuery(teamId)
  const bootstrapCoreReady = dashQ.data ? dashQ.data.deferredPending === false : false
  const bootstrapThreadsInbox = bootstrapCoreReady ? dashQ.data?.messageThreadsInbox : undefined

  const freePortalBasePath = useMemo(
    () => `/player/${encodeURIComponent(accountSegment)}`,
    [accountSegment]
  )

  return (
    <div className="mx-auto w-full max-w-lg pb-4 lg:max-w-2xl">
      {/* Screen title */}
      <div className="mb-[16px] flex items-baseline justify-between">
        <span className="font-black text-[22px] uppercase tracking-[0.02em] text-[#EEF3FF]">Messages</span>
      </div>

      {/* Dark-themed chat container */}
      <div
        className="overflow-hidden rounded-[22px] border border-[rgba(125,155,255,0.14)]"
        style={{ background: "linear-gradient(180deg,#13234E,#0E1B3E)" }}
      >
        <PortalStandardPageRoot className="flex min-h-0 flex-col !space-y-0 overflow-hidden pb-0">
          <MessagingManager
            teamId={teamId}
            userRole="PLAYER"
            userId={userId}
            bootstrapThreadsInbox={bootstrapThreadsInbox}
            bootstrapCoreReady={bootstrapCoreReady}
            routeThreadId={routeThreadId ?? undefined}
            freePortalBasePath={freePortalBasePath}
          />
        </PortalStandardPageRoot>
      </div>
    </div>
  )
}
