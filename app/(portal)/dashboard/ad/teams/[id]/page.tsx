import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { redirect } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AdTeamEditPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", session.user.id)
    .maybeSingle()

  if (!profile?.school_id) {
    redirect("/dashboard/ad/teams")
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, sport, roster_size, season, notes")
    .eq("id", params.id)
    .eq("school_id", profile.school_id)
    .maybeSingle()

  if (!team) {
    redirect("/dashboard/ad/teams")
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/ad/teams"
          className="text-sm font-medium text-[#3B82F6] hover:underline mb-2 inline-block"
        >
          ← Back to teams
        </Link>
        <h1 className="text-2xl font-bold text-[#212529]">Edit team</h1>
        <p className="mt-1 text-[#6B7280]">{team.name}</p>
      </div>
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <p className="text-[#6B7280]">
          Full team editing (sport, roster size, coach assignment) will be available in a future update.
        </p>
        <dl className="mt-4 grid gap-2 text-sm">
          <div>
            <dt className="font-medium text-[#6B7280]">Sport</dt>
            <dd className="text-[#212529]">{(team as { sport?: string }).sport ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Roster size</dt>
            <dd className="text-[#212529]">{(team as { roster_size?: number }).roster_size ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Season</dt>
            <dd className="text-[#212529]">{(team as { season?: string }).season ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
