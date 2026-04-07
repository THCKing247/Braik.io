"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { WeightRoomModule } from "@/components/portal/weight-room-module"
import { WeightRoomScaffold } from "@/components/portal/weight-room-scaffold"

export default function WeightRoomPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) =>
        canEdit ? <WeightRoomModule teamId={teamId} /> : <WeightRoomScaffold canEdit={canEdit} />
      }
    </DashboardPageShell>
  )
}
