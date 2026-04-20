"use client"

import { useMemo } from "react"
import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"
import { MessagingManager } from "@/components/portal/messaging-manager"
import { PortalStandardPageRoot } from "@/components/portal/portal-standard-page"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"

/**
 * Parent messaging uses the signed-in parent identity (`userId` / PARENT) — never the athlete account.
 */
export function ParentPortalMessages({ routeThreadId }: { routeThreadId?: string | null }) {
  const { teamId, parentUserId, linkCodeSegment } = useParentPortal()
  const dashQ = useDashboardBootstrapQuery(teamId)
  const bootstrapCoreReady = dashQ.data ? dashQ.data.deferredPending === false : false
  const bootstrapThreadsInbox = bootstrapCoreReady ? dashQ.data?.messageThreadsInbox : undefined

  const freePortalBasePath = useMemo(
    () => `/parent/${encodeURIComponent(linkCodeSegment)}`,
    [linkCodeSegment]
  )

  return (
    <div className="flex min-h-[min(720px,calc(100dvh-13rem))] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <PortalStandardPageRoot className="flex min-h-0 flex-1 flex-col !space-y-0 overflow-hidden pb-0">
        <MessagingManager
          teamId={teamId}
          userRole="PARENT"
          userId={parentUserId}
          bootstrapThreadsInbox={bootstrapThreadsInbox}
          bootstrapCoreReady={bootstrapCoreReady}
          routeThreadId={routeThreadId ?? undefined}
          freePortalBasePath={freePortalBasePath}
        />
      </PortalStandardPageRoot>
    </div>
  )
}
