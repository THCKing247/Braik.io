import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { redirect } from "next/navigation"
import Link from "next/link"
import { logAdTeamVisibility, resolveAdPortalTeamScope, teamRowVisibleToAdScope } from "@/lib/ad-team-scope"
import { canAccessAdPortalRoutes } from "@/lib/enforcement/football-ad-access"
import { assistantCoachUserIds, pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"
import { AdTeamEditForm } from "@/components/portal/ad/ad-team-edit-form"
import { SPORT_OPTIONS } from "@/lib/pricing-sports"

export const dynamic = "force-dynamic"

export default async function AdTeamEditPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
  const { scope, orFilter: teamsOrFilter, footballAccess } = await resolveAdPortalTeamScope(
    supabase,
    session.user.id
  )

  if (!canAccessAdPortalRoutes(footballAccess) || !teamsOrFilter) {
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
    .select(
      "id, name, sport, roster_size, season, notes, school_id, athletic_department_id, program_id, team_level, gender"
    )
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

  let headCoachEmail: string | null = null
  if (headCoachUserId) {
    const { data: hp } = await supabase.from("profiles").select("email").eq("id", headCoachUserId).maybeSingle()
    headCoachEmail = (hp?.email as string | null) ?? null
  }

  const assistantNames = assistantIds
    .map((id) => nameById.get(id))
    .filter((n): n is string => Boolean(n && n.length > 0))

  const rawSport =
    (team as { sport?: string | null }).sport?.trim() || programSport?.trim() || "football"
  const sportDisplay =
    SPORT_OPTIONS.find((o) => o.toLowerCase() === rawSport.toLowerCase()) ?? "Football"

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
        <AdTeamEditForm
          teamId={team.id}
          initialName={(team as { name?: string | null }).name ?? ""}
          initialSport={sportDisplay}
          initialRosterSize={(team as { roster_size?: number | null }).roster_size ?? null}
          initialTeamLevel={(team as { team_level?: string | null }).team_level ?? null}
          initialGender={(team as { gender?: string | null }).gender ?? null}
          initialHeadCoachEmail={headCoachEmail}
        />
        <dl className="mt-8 grid gap-2 text-sm border-t border-[#E5E7EB] pt-6">
          <div>
            <dt className="font-medium text-[#6B7280]">Head coach (display)</dt>
            <dd className="text-[#212529]">{headCoachDisplay ?? "No head coach assigned"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Assistant coaches</dt>
            <dd className="text-[#212529]">
              {assistantNames.length > 0 ? assistantNames.join(", ") : "None listed"}
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
