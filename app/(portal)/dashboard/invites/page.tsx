"use client"

import dynamic from "next/dynamic"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

const InviteManager = dynamic(
  () => import("@/components/portal/invite-manager").then((m) => m.InviteManager),
  { loading: () => <div className="min-h-[40vh] w-full animate-pulse rounded-xl bg-muted" aria-hidden /> }
)

export default function InvitesPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => <InviteManager teamId={teamId} invites={[]} />}
    </DashboardPageShell>
  )
}
