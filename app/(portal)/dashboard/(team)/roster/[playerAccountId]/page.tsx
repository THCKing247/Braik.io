"use client"

import { useParams, usePathname, useSearchParams } from "next/navigation"
import {
  buildDashboardTeamRosterPath,
  parseCanonicalDashboardTeamPath,
} from "@/lib/navigation/organization-routes"
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
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const playerRouteSegment = (params?.playerAccountId as string) ?? ""
  const canonicalTeamParts = parseCanonicalDashboardTeamPath(pathname)
  const resolvedTeamId = searchParams.get("teamId") || teamId
  const view = searchParams.get("view")
  const q = searchParams.get("q")
  const position = searchParams.get("position")
  const rosterParams = new URLSearchParams()
  if (!canonicalTeamParts && resolvedTeamId) rosterParams.set("teamId", resolvedTeamId)
  if (view) rosterParams.set("view", view)
  if (q) rosterParams.set("q", q)
  if (position) rosterParams.set("position", position)
  const qs = rosterParams.toString()
  const backHref = canonicalTeamParts
    ? `${buildDashboardTeamRosterPath(canonicalTeamParts)}${qs ? `?${qs}` : ""}`
    : `/dashboard/roster${qs ? `?${qs}` : ""}`

  if (!playerRouteSegment) {
    return (
      <div className="rounded-lg border border-[rgb(var(--border))] bg-white p-6 text-center">
        <p className="text-sm text-[rgb(var(--muted))]">Invalid player.</p>
        <a href={backHref} className="mt-4 inline-block text-[#3B82F6] hover:underline">Back to Roster</a>
      </div>
    )
  }

  return (
    <PlayerProfileView
      rosterPlayerSegment={playerRouteSegment}
      teamId={resolvedTeamId}
      canEdit={canEdit}
      backHref={backHref}
    />
  )
}
