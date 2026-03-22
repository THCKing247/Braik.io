import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  buildAdTeamsOrFilter,
  logAdTeamVisibility,
  resolveAthleticDirectorScope,
  teamRowVisibleToAdScope,
} from "@/lib/ad-team-scope"
import { assistantCoachUserIds, pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

export const dynamic = "force-dynamic"

export default async function AdTeamEditPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
  const scope = await resolveAthleticDirectorScope(supabase, session.user.id)
  const teamsOrFilter = buildAdTeamsOrFilter(scope)

  if (!teamsOrFilter) {
    logAdTeamVisibility("AdTeamEditPage", {
      scope,
      sessionRole: session.user.role ?? null,
      teamCount: 0,
      teamIds: [],
      filter: null,
      queryError: "no_scope",
    })
    redirect("/dashboard/ad/teams")
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, sport, roster_size, season, notes, school_id, athletic_department_id, program_id")
    .eq("id", params.id)
    .maybeSingle()

  let programSport: string | null = null
  const pid = team ? (team as { program_id?: string | null }).program_id : null
  if (pid) {
    const { data: prog } = await supabase.from("programs").select("sport").eq("id", pid).maybeSingle()
    programSport = (prog?.sport as string) || null
  }

  if (!team || !teamRowVisibleToAdScope(team, scope)) {
    logAdTeamVisibility("AdTeamEditPage", {
      scope,
      sessionRole: session.user.role ?? null,
      teamCount: 0,
      teamIds: [],
      filter: `team_id.eq.${params.id}`,
      queryError: team ? "team_not_in_ad_scope" : "team_not_found",
    })
    redirect("/dashboard/ad/teams")
  }

  logAdTeamVisibility("AdTeamEditPage", {
    scope,
    sessionRole: session.user.role ?? null,
    teamCount: 1,
    teamIds: [team.id],
    filter: `team_id.eq.${params.id}`,
    queryError: null,
  })

  const { data: staffRows } = await supabase
    .from("team_members")
    .select("user_id, role, is_primary")
    .eq("team_id", team.id)
    .eq("active", true)

  const staff: TeamMemberStaffRow[] = (staffRows ?? []).map((r) => ({
    user_id: (r as { user_id: string }).user_id,
    role: (r as { role: string }).role,
    is_primary: (r as { is_primary?: boolean | null }).is_primary,
  }))

  const headCoachUserId = pickHeadCoachUserId(staff)
  const assistantIds = assistantCoachUserIds(staff)
  const nameIds = [...new Set([headCoachUserId, ...assistantIds].filter((id): id is string => Boolean(id)))]
  const { data: staffUsers } =
    nameIds.length > 0
      ? await supabase.from("users").select("id, name").in("id", nameIds)
      : { data: [] as { id: string; name: string | null }[] }
  const nameById = new Map((staffUsers ?? []).map((u) => [u.id, u.name?.trim() || null]))

  const rawHcName = headCoachUserId ? nameById.get(headCoachUserId) : null
  const headCoachDisplay = rawHcName && rawHcName.length > 0 ? rawHcName : null

  const assistantNames = assistantIds
    .map((id) => nameById.get(id))
    .filter((n): n is string => Boolean(n && n.length > 0))

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
            <dt className="font-medium text-[#6B7280]">Head coach</dt>
            <dd className="text-[#212529]">{headCoachDisplay ?? "No head coach assigned"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Assistant coaches</dt>
            <dd className="text-[#212529]">
              {assistantNames.length > 0 ? assistantNames.join(", ") : "None listed"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Sport</dt>
            <dd className="text-[#212529]">
              {(team as { sport?: string | null }).sport?.trim() ||
                programSport?.trim() ||
                "Not set"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Roster size</dt>
            <dd className="text-[#212529]">
              {(team as { roster_size?: number | null }).roster_size != null
                ? String((team as { roster_size?: number | null }).roster_size)
                : "Not set"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Season</dt>
            <dd className="text-[#212529]">
              {(team as { season?: string | null }).season?.trim() || "Not set"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
