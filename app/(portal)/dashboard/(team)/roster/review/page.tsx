"use client"

import Link from "next/link"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { RosterClaimReviewPanel } from "@/components/portal/roster-claim-review-panel"

export default function RosterClaimReviewPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <div className="w-full min-w-0 max-w-full overflow-x-hidden px-4 py-4 lg:px-0 space-y-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold font-athletic uppercase tracking-tight" style={{ color: "rgb(var(--text))" }}>
                Roster signup review
              </h1>
              <p className="text-sm mt-1" style={{ color: "rgb(var(--muted))" }}>
                Unclaimed coach spots, self-registered players, and linked accounts.
              </p>
            </div>
            <Link
              href="/dashboard/roster"
              className="text-sm font-medium text-[#2563EB] hover:underline shrink-0"
            >
              ← Back to roster
            </Link>
          </div>
          <RosterClaimReviewPanel teamId={teamId} canEdit={canEdit} />
        </div>
      )}
    </DashboardPageShell>
  )
}
