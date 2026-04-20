"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { InventoryManager } from "@/components/portal/inventory-manager"
import { PortalStandardPage } from "@/components/portal/portal-standard-page"

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
    <PortalStandardPage title="Inventory" description="Track gear, assignments, costs, and equipment condition across your program.">
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
    </PortalStandardPage>
  )
}
