"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { MessagingManager } from "@/components/portal/messaging-manager"
import { PortalStandardPage } from "@/components/portal/portal-standard-page"
import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"

export default function MessagesPage() {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, userId }) => (
        <MessagesPageInner teamId={teamId} userRole={userRole} userId={userId} />
      )}
    </DashboardPageShell>
  )
}

function MessagesPageInner({
  teamId,
  userRole,
  userId,
}: {
  teamId: string
  userRole: string
  userId: string
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
      />
    </PortalStandardPage>
  )
}
