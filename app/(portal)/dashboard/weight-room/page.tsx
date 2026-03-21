"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { WeightRoomScaffold } from "@/components/portal/weight-room-scaffold"

export default function WeightRoomPage() {
  return (
    <DashboardPageShell>
      {({ canEdit }) => <WeightRoomScaffold canEdit={canEdit} />}
    </DashboardPageShell>
  )
}
