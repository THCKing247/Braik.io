"use client"

import { useParams, useSearchParams } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlayerProfileView } from "@/components/portal/player-profile-view"

export default function PlayerProfilePage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <PlayerProfilePageContent teamId={teamId} canEdit={canEdit} />
      )}
    </DashboardPageShell>
  )
}

function PlayerProfilePageContent({
  teamId,
  canEdit,
}: {
  teamId: string
  canEdit: boolean
}) {
  const params = useParams()
  const searchParams = useSearchParams()
  const playerId = (params?.playerId as string) ?? ""
  const resolvedTeamId = searchParams.get("teamId") || teamId
  const backHref = resolvedTeamId
    ? `/dashboard/roster?teamId=${encodeURIComponent(resolvedTeamId)}`
    : "/dashboard/roster"

  if (!playerId) {
    return (
      <div className="rounded-lg border border-[rgb(var(--border))] bg-white p-6 text-center">
        <p className="text-sm text-[rgb(var(--muted))]">Invalid player.</p>
        <a href={backHref} className="mt-4 inline-block text-[#3B82F6] hover:underline">Back to Roster</a>
      </div>
    )
  }

  return (
    <PlayerProfileView
      playerId={playerId}
      teamId={resolvedTeamId}
      canEdit={canEdit}
      backHref={backHref}
    />
  )
}
