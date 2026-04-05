import { AdTeamsTableSkeleton } from "@/components/portal/ad/ad-teams-table"

/**
 * Narrow loading UI for `/dashboard/ad/teams` while the server page resolves.
 * Parent `ad/loading.tsx` covers other AD routes; this replaces the generic dashboard skeleton for teams only.
 */
export default function AdTeamsSegmentLoading() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#212529]">Teams</h1>
        <p className="mt-1 text-[#6B7280]">
          Teams from your program and department. New teams are added through signup and provisioning; open a
          team’s Head Coach portal from here when listed.
        </p>
      </div>
      <AdTeamsTableSkeleton rows={10} />
    </div>
  )
}
