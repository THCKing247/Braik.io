"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { WeightRoomModule } from "@/components/portal/weight-room-module"
import { WeightRoomScaffold } from "@/components/portal/weight-room-scaffold"
import { canEditRoster } from "@/lib/auth/roles"
import type { Role } from "@/lib/auth/roles"

export default function WeightRoomPage() {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, canEdit }) =>
        canEditRoster(userRole as Role) ? (
          <WeightRoomModule teamId={teamId} />
        ) : (
          <WeightRoomScaffold canEdit={canEdit} userRole={userRole} />
        )
      }
    </DashboardPageShell>
  )
}
