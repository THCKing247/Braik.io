import { NextResponse } from "next/server"
import { getRequestUserLite, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { buildAppAdPortalBootstrapPayload } from "@/lib/app/build-app-ad-portal-bootstrap"
import { fetchAdCoachRoleCountsByLevel } from "@/lib/ad-coach-role-counts"
import { logAdDashboardMetrics, logAdTeamVisibility } from "@/lib/ad-team-scope"

export const runtime = "nodejs"

export async function GET() {
  try {
    const sessionResult = await getRequestUserLite()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const u = sessionResult.user
    const supabase = getSupabaseServer()

    let shell: Awaited<ReturnType<typeof buildAppAdPortalBootstrapPayload>>
    try {
      shell = await buildAppAdPortalBootstrapPayload(supabase, {
        userId: u.id,
        email: u.email,
        liteRole: u.role ?? "",
        isPlatformOwner: u.isPlatformOwner === true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === "AD_BOOTSTRAP_FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      throw err
    }

    if (!shell.flags.tabVisibility.showOverview) {
      const res = NextResponse.json({ redirectTo: "/dashboard/ad/teams" as const })
      if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
      return res
    }

    const school = shell.school.name ? { name: shell.school.name } : null
    const department = shell.organization.departmentStatus
      ? { status: shell.organization.departmentStatus }
      : null

    const { scope, orFilter, teamsQueryError } = shell
    const teamIds = shell.teamsSummary.map((t) => t.id)
    const teamsCount = shell.teamsSummary.length

    logAdTeamVisibility("AdOverviewApi", {
      scope,
      sessionRole: u.role ?? null,
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

    logAdDashboardMetrics("AdOverviewApi", {
      scope,
      sessionRole: u.role ?? null,
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

    const res = NextResponse.json({
      school,
      department,
      teamsCount,
      athletesCount,
      headCoachCount,
      assistantCoachCount,
      emptyStateTriggered,
    })
    if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    return res
  } catch (err) {
    console.error("[GET /api/ad/pages/overview]", err)
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 })
  }
}
