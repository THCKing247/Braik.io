"use client"

import dynamic from "next/dynamic"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

const FundraisingView = dynamic(
  () => import("@/components/portal/fundraising-view").then((m) => m.FundraisingView),
  { loading: () => <div className="min-h-[45vh] w-full animate-pulse rounded-xl bg-muted" aria-hidden /> }
)

export default function FundraisingPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => <FundraisingView teamId={teamId} />}
    </DashboardPageShell>
  )
}
