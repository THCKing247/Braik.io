import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { AdCoachesPageClient } from "@/components/portal/ad/ad-coaches-page-client"
import { fetchAdCoachAssignmentsPageData } from "@/lib/ad-portal-coach-assignments"
import { logAdDashboardMetrics, logAdTeamVisibility } from "@/lib/ad-team-scope"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import { AdFootballProgramHub } from "@/components/portal/ad/ad-football-program-hub"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AdCoachesPage() {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
<<<<<<< HEAD
  const {
    headRows,
    assistantRows,
    teamsPicklist,
    scope,
    orFilter,
    teamsQueryError,
  } = await fetchAdCoachAssignmentsPageData(supabase, session.user.id)

  const visibleTeamIds = teamsPicklist.map((t) => t.id)
  const visibleTeamCount = visibleTeamIds.length
=======
  const access = await getAdPortalAccessForUser(
    supabase,
    session.user.id,
    session.user.role?.toUpperCase()
  )
  const sessionRoleUpper = session.user.role?.toUpperCase() ?? ""
  const showFootballProgramHub =
    sessionRoleUpper === "HEAD_COACH" &&
    (access.mode === "restricted_football" || access.footballProgramIds.length > 0)

  const result = await fetchAdPrimaryHeadCoaches(
    supabase,
    session.user.id,
    session.user.role ?? null,
    access
  )
  const { coaches, scope, orFilter, visibleTeamIds, visibleTeamCount, teamsQueryError } = result
>>>>>>> origin/main

  logAdTeamVisibility("AdCoachesPage", {
    scope,
    sessionRole: session.user.role ?? null,
    teamCount: visibleTeamCount,
    teamIds: visibleTeamIds,
    filter: orFilter,
    queryError: teamsQueryError,
  })

  const headCoachMembershipCount = headRows.filter((r) => r.userId).length
  const assistantCoachMembershipCount = assistantRows.length

  logAdDashboardMetrics("AdCoachesPage", {
    scope,
    sessionRole: session.user.role ?? null,
    visibleTeamIds,
    teamCount: visibleTeamCount,
    headCoachMembershipCount,
    assistantCoachMembershipCount,
    totalCoachMemberships: headCoachMembershipCount + assistantCoachMembershipCount,
    athleteCount: 0,
    emptyStateTriggered: visibleTeamCount === 0,
    orFilter,
    teamsQueryError,
    playersCountError: null,
  })

  return (
<<<<<<< HEAD
    <AdCoachesPageClient
      headRows={headRows}
      assistantRows={assistantRows}
      teamsPicklist={teamsPicklist}
    />
=======
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#212529]">Coaches</h1>
          <p className="mt-1 text-[#6B7280]">View and manage coaches across your department.</p>
          <p className="mt-2 text-sm text-[#6B7280]">
            Send coach invites from the main dashboard{" "}
            <Link href="/dashboard/invites" className="text-[#3B82F6] font-medium hover:underline">
              Invites
            </Link>{" "}
            page (select the team there), or from a team after you open it from the Teams tab.
          </p>
        </div>
      </div>

      {coaches.length === 0 ? (
        <AdEmptyState
          title="No head coaches yet"
          description="Primary head coaches appear here from team memberships in your visible teams. Assign a head coach when editing a team in this portal, or invite coaches from Invites after opening a team from Teams. Varsity HCs can use Football program staffing below for JV/Freshman heads and team placement."
        />
      ) : (
        <AdCoachesTable coaches={coaches} />
      )}

      {showFootballProgramHub ? (
        <div className="pt-6 border-t border-[#E5E7EB]">
          <AdFootballProgramHub />
        </div>
      ) : null}
    </div>
>>>>>>> origin/main
  )
}
