"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { FundraisingView } from "@/components/portal/fundraising-view"

export default function FundraisingPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => <FundraisingView teamId={teamId} />}
    </DashboardPageShell>
  )
}
