import Link from "next/link"
import { AdTeamForm } from "@/components/portal/ad/ad-team-form"

export const dynamic = "force-dynamic"

export default function AdTeamsNewPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/ad/teams"
          className="text-sm font-medium text-[#3B82F6] hover:underline mb-2 inline-block"
        >
          ← Back to teams
        </Link>
        <h1 className="text-2xl font-bold text-[#212529]">Create team</h1>
        <p className="mt-1 text-[#6B7280]">
          Add a new team to your athletic department. You can invite a head coach now or assign one later.
        </p>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <AdTeamForm />
      </div>
    </div>
  )
}
