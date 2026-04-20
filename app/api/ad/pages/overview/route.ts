import { NextResponse } from "next/server"
import { applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getCachedAppAdPortalBootstrap } from "@/lib/app/app-bootstrap-cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import { fetchAdCoachRoleCountsByLevel } from "@/lib/ad-coach-role-counts"
import {
  fetchAdVisibleTeamsForAccess,
  logAdDashboardMetrics,
  logAdTeamVisibility,
} from "@/lib/ad-team-scope"
import { resolveFootballAdAccessState } from "@/lib/enforcement/football-ad-access"
import {
  buildOrganizationPortalPath,
  resolveDefaultOrganizationPortalUuidForUser,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

export async function GET() {
  try {
    const sessionResult = await getRequestAuth()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const u = sessionResult.user
    const supabase = getSupabaseServer()

    let shell: AppAdPortalBootstrapPayload
    try {
      // Align with GET /api/app/bootstrap?portal=ad so unstable_cache can serve the same shell snapshot.
      shell = await getCachedAppAdPortalBootstrap(
        u.id,
        u.email,
        u.role ?? "",
        u.isPlatformOwner === true,
        false
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === "AD_BOOTSTRAP_FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      throw err
    }

    if (!shell.flags.tabVisibility.showOverview) {
      const orgPortalUuid = await resolveDefaultOrganizationPortalUuidForUser(supabase, u.id)
      const redirectTo = orgPortalUuid ? buildOrganizationPortalPath(orgPortalUuid, "/teams") : "/dashboard/ad/teams"
      const res = NextResponse.json({ redirectTo })
      if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
      return res
    }

    const school = shell.school.name ? { name: shell.school.name } : null
    const department = shell.organization.departmentStatus
      ? { status: shell.organization.departmentStatus }
      : null

    const { scope, orFilter } = shell

    const footballAccess = await resolveFootballAdAccessState(supabase, u.id)
    const { teams: visibleTeams, error: visibleTeamsListError } = await fetchAdVisibleTeamsForAccess(
      supabase,
      u.id,
      shell.adPortalAccess,
      { reuseFootballAccess: footballAccess, teamsSelectMode: "picklist" }
    )
    const teamIds = visibleTeams.map((t) => t.id)
    const teamsCount = teamIds.length
    const teamsListQueryError = visibleTeamsListError ?? null

    logAdTeamVisibility("AdOverviewApi", {
      scope,
      sessionRole: u.role ?? null,
      teamCount: teamsCount,
      teamIds,
      filter: orFilter,
      queryError:
        teamsListQueryError ??
        (!orFilter ? "no_or_filter: missing school, department, and linked programs" : null),
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
    if (teamIds.length > 0 && !teamsListQueryError) {
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
      teamsQueryError: teamsListQueryError,
      playersCountError,
    })

    const res = NextResponse.json(
      {
        school,
        department,
        teamsCount,
        athletesCount,
        headCoachCount,
        assistantCoachCount,
        emptyStateTriggered,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, must-revalidate",
        },
      }
    )
    if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    return res
  } catch (err) {
    console.error("[GET /api/ad/pages/overview]", err)
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 })
  }
}
