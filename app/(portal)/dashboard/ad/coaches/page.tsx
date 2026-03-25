import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { AdCoachesPageClient } from "@/components/portal/ad/ad-coaches-page-client"
import { fetchAdCoachAssignmentsPageData } from "@/lib/ad-portal-coach-assignments"
import { logAdDashboardMetrics, logAdTeamVisibility } from "@/lib/ad-team-scope"

export const dynamic = "force-dynamic"

export default async function AdCoachesPage() {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
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
    <AdCoachesPageClient
      headRows={headRows}
      assistantRows={assistantRows}
      teamsPicklist={teamsPicklist}
    />
  )
}
