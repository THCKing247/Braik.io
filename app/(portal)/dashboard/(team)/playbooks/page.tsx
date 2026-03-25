"use client"

import dynamic from "next/dynamic"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

const PlaybooksBrowse = dynamic(
  () => import("@/components/portal/playbooks-browse").then((m) => m.PlaybooksBrowse),
  {
    loading: () => (
      <div
        className="flex min-h-[400px] w-full animate-pulse rounded-2xl bg-muted lg:min-h-[775px]"
        aria-hidden
      />
    ),
  }
)

export default function PlaybooksPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <div className="min-h-[400px] lg:min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden max-w-full">
          <PlaybooksBrowse teamId={teamId} canEdit={canEdit} />
        </div>
      )}
    </DashboardPageShell>
  )
}
