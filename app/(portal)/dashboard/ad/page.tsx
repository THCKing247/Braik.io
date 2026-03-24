import { redirect } from "next/navigation"
import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { AdOverviewCards } from "@/components/portal/ad/ad-overview-cards"
import { AdLinkCodeGenerator } from "@/components/portal/ad/ad-link-code-generator"
import Link from "next/link"
import { fetchAdCoachRoleCountsByLevel } from "@/lib/ad-coach-role-counts"
import {
  fetchAdVisibleTeamsForAccess,
  logAdDashboardMetrics,
  logAdTeamVisibility,
} from "@/lib/ad-team-scope"
import { getAdPortalAccessForUser, adPortalShowsOverviewAndSettings } from "@/lib/ad-portal-access"

export const dynamic = "force-dynamic"

export default async function AthleticDirectorOverviewPage() {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
  const access = await getAdPortalAccessForUser(
    supabase,
    session.user.id,
    session.user.role?.toUpperCase()
  )
  if (!adPortalShowsOverviewAndSettings(access)) {
    redirect("/dashboard/ad/teams")
  }

  let school: { name: string } | null = null
  let department: { status: string } | null = null

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", session.user.id)
    .maybeSingle()

  if (profile?.school_id) {
    const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", profile.school_id).single()
    school = schoolRow
  }

  const { data: deptRow } = await supabase
    .from("athletic_departments")
    .select("status")
    .eq("athletic_director_user_id", session.user.id)
    .maybeSingle()
  department = deptRow

  const { scope, orFilter, teams: visibleTeams, error: teamsQueryError } = await fetchAdVisibleTeamsForAccess(
    supabase,
    session.user.id,
    access
  )

  const teamIds = visibleTeams.map((t) => t.id)
  const teamsCount = visibleTeams.length

  logAdTeamVisibility("AthleticDirectorOverviewPage", {
    scope,
    sessionRole: session.user.role ?? null,
    teamCount: teamsCount,
    teamIds,
    filter: orFilter,
    queryError: teamsQueryError ?? (!orFilter ? "no_or_filter: missing school, department, and linked programs" : null),
  })

  let athletesCount = 0
  let playersCountError: string | null = null
  if (teamIds.length > 0) {
    const { count, error: playersErr } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .in("team_id", teamIds)
      .eq("status", "active")
    athletesCount = count ?? 0
    playersCountError = playersErr?.message ?? null
  }

  let headCoachCount = 0
  let assistantCoachCount = 0
  if (teamIds.length > 0 && !teamsQueryError) {
    const roleCounts = await fetchAdCoachRoleCountsByLevel(supabase, teamIds)
    headCoachCount = roleCounts.headCoachCount
    assistantCoachCount = roleCounts.assistantCoachCount
  }
  const totalCoachMemberships = headCoachCount + assistantCoachCount

  const emptyStateTriggered = teamsCount === 0

  logAdDashboardMetrics("AthleticDirectorOverviewPage", {
    scope,
    sessionRole: session.user.role ?? null,
    visibleTeamIds: teamIds,
    teamCount: teamsCount,
    headCoachMembershipCount: headCoachCount,
    assistantCoachMembershipCount: assistantCoachCount,
    totalCoachMemberships,
    athleteCount: athletesCount,
    emptyStateTriggered,
    orFilter,
    teamsQueryError: teamsQueryError ?? null,
    playersCountError,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#212529]">Department overview</h1>
        <p className="mt-1 text-[#6B7280]">
          {school?.name ? `${school.name} — Athletic Department` : "Your athletic department at a glance."}
        </p>
      </div>

      <AdOverviewCards
        totalTeams={teamsCount}
        totalAthletes={athletesCount}
        headCoachCount={headCoachCount}
        assistantCoachCount={assistantCoachCount}
        totalParents={0}
        planStatus={department?.status ?? "active"}
        departmentPlan="Athletic Department License"
      />

      {emptyStateTriggered && (
        <div className="rounded-xl border-2 border-[#3B82F6] bg-[#EFF6FF] p-6">
          <h2 className="text-lg font-semibold text-[#1E40AF]">Get started with your department</h2>
          <p className="mt-2 text-sm text-[#1E3A8A]">
            Create your first team and invite a head coach to start using Braik.
          </p>
          <Link
            href="/dashboard/ad/teams/new"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
          >
            Create your first team
          </Link>
        </div>
      )}

      <AdLinkCodeGenerator />

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#212529]">Recent activity</h2>
        <p className="mt-2 text-sm text-[#6B7280]">Activity feed will appear here as you add teams and coaches.</p>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#212529]">Billing & plan</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[#F9FAFB] p-4">
          <div>
            <p className="font-medium text-[#212529]">Athletic Department License</p>
            <p className="text-2xl font-bold text-[#212529]">$6,500 <span className="text-sm font-normal text-[#6B7280]">/ year</span></p>
            <p className="mt-1 text-sm text-[#6B7280]">Unlimited teams, athletes, and coaches</p>
          </div>
          <div className="rounded-md bg-[#D1FAE5] px-3 py-1 text-sm font-medium text-[#065F46]">
            Status: {department?.status ?? "active"}
          </div>
        </div>
        <p className="mt-4 text-sm text-[#6B7280]">
          Billing and renewal are managed through your account. Contact support to update payment or plan.
        </p>
      </div>
    </div>
  )
}
