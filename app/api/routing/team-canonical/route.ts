import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  buildDashboardTeamPath,
  resolveCanonicalTeamRouteByTeamId,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

/** Resolve legacy `teamId` into canonical org/team dashboard path. */
export async function GET(request: Request) {
  const auth = await getRequestAuth()
  if (!auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const teamId = new URL(request.url).searchParams.get("teamId")?.trim()
  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 })
  }

  const canonical = await resolveCanonicalTeamRouteByTeamId(getSupabaseServer(), teamId)
  if (!canonical) {
    return NextResponse.json({ error: "Team not found for canonical route" }, { status: 404 })
  }

  return NextResponse.json({
    shortOrgId: canonical.shortOrgId,
    organizationPortalUuid: canonical.organizationPortalUuid,
    shortTeamId: canonical.shortTeamId,
    path: buildDashboardTeamPath(canonical),
  })
}
