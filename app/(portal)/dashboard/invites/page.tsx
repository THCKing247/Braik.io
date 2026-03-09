"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { InviteManager } from "@/components/portal/invite-manager"

export default function InvitesPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => <InviteManager teamId={teamId} invites={[]} />}
    </DashboardPageShell>
  )
}
