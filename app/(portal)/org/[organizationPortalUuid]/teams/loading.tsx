import { AdTeamsTableSkeleton } from "@/components/portal/ad/ad-teams-table"
import { AppLoader } from "@/components/ui/app-loader"

export default function OrganizationTeamsSegmentLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div>
        <h1 className="text-2xl font-bold text-[#212529]">Teams</h1>
        <p className="mt-1 text-[#6B7280]">
          Teams from your program and department. New teams are added through signup and provisioning; open a
          team&apos;s Head Coach portal from here when listed.
        </p>
        <div className="mt-4">
          <AppLoader label="Loading teams" size="md" />
        </div>
      </div>
      <AdTeamsTableSkeleton rows={10} />
    </div>
  )
}
