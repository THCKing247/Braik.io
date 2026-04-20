"use client"

import { DashboardTeamMessagesPage } from "@/components/portal/dashboard-team-messages-page"

export default function MessagesThreadPage({ params }: { params: { messageId: string } }) {
  return <DashboardTeamMessagesPage routeThreadId={params.messageId} />
}
