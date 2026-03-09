"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { InvoicePageClient } from "@/components/portal/invoice-page-client"

export default function InvoicePage() {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, userId }) => (
        <InvoicePageClient
          team={{
            id: teamId,
            name: "",
            amountPaid: 0,
            subscriptionPaid: false,
            teamIdCode: "",
            duesAmount: 0,
          }}
          players={[]}
          membership={null}
          collections={[]}
          currentUserId={userId}
          userRole={userRole}
        />
      )}
    </DashboardPageShell>
  )
}
