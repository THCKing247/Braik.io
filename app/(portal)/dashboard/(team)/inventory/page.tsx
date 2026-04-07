"use client"

import dynamic from "next/dynamic"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

const InventoryManager = dynamic(
  () => import("@/components/portal/inventory-manager").then((m) => m.InventoryManager),
  { loading: () => <div className="min-h-[45vh] w-full animate-pulse rounded-xl bg-muted" aria-hidden /> }
)

const defaultCoachPermissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canAssign: true,
  canViewAll: true,
  scopedPlayerIds: null as string[] | null,
}

export default function InventoryPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => (
        <InventoryPageContent teamId={teamId} />
      )}
    </DashboardPageShell>
  )
}

function InventoryPageContent({ teamId }: { teamId: string }) {
  return (
    <InventoryManager
      teamId={teamId}
      initialItems={[]}
      players={[]}
      permissions={defaultCoachPermissions}
      initialRecentUnitCostChanges={[]}
      initialPendingConditionReportCount={0}
      initialViewer={{ canReportCondition: false, canApproveConditionReports: false }}
      bootstrapInventory
    />
  )
}
