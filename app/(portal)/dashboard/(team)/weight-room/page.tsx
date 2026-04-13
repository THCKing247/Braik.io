"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { WeightRoomModule } from "@/components/portal/weight-room-module"

export default function WeightRoomPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => <WeightRoomModule teamId={teamId} canEdit={canEdit} />}
    </DashboardPageShell>
  )
}
