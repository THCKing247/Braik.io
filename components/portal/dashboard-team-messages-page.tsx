"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { MessagingManager } from "@/components/portal/messaging-manager"
import { PortalStandardPage } from "@/components/portal/portal-standard-page"
import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"

function MessagesBody({
  teamId,
  userRole,
  userId,
  routeThreadId,
}: {
  teamId: string
  userRole: string
  userId: string
  routeThreadId?: string | null
}) {
  const dashQ = useDashboardBootstrapQuery(teamId)
  const bootstrapCoreReady = dashQ.data ? dashQ.data.deferredPending === false : false
  const bootstrapThreadsInbox = bootstrapCoreReady ? dashQ.data?.messageThreadsInbox : undefined

  return (
    <PortalStandardPage className="pb-3" title="Messages" description="Inbox and conversations for your team.">
      <MessagingManager
        teamId={teamId}
        userRole={userRole}
        userId={userId}
        bootstrapThreadsInbox={bootstrapThreadsInbox}
        bootstrapCoreReady={bootstrapCoreReady}
        routeThreadId={routeThreadId ?? undefined}
      />
    </PortalStandardPage>
  )
}

/** Team messages — optional `routeThreadId` matches `/dashboard/org/.../team/.../messages/:messageId`. */
export function DashboardTeamMessagesPage({ routeThreadId }: { routeThreadId?: string | null }) {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, userId }) => (
        <MessagesBody
          teamId={teamId}
          userRole={userRole}
          userId={userId}
          routeThreadId={routeThreadId}
        />
      )}
    </DashboardPageShell>
  )
}
