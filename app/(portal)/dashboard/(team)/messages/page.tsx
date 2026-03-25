"use client"

import dynamic from "next/dynamic"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { DashboardMessagesSkeleton } from "@/components/portal/dashboard-route-skeletons"

const MessagingManager = dynamic(
  () => import("@/components/portal/messaging-manager").then((m) => m.MessagingManager),
  { loading: () => <DashboardMessagesSkeleton /> }
)

export default function MessagesPage() {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, userId }) => (
        <MessagingManager
          teamId={teamId}
          userRole={userRole}
          userId={userId}
          initialThreads={[]}
        />
      )}
    </DashboardPageShell>
  )
}
