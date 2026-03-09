"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { MessagingManager } from "@/components/portal/messaging-manager"

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
