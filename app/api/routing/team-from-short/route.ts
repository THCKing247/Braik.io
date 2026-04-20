import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  resolveOrganizationPortalUuidFromShortOrgId,
  resolveTeamIdFromShortOrgTeamIds,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

/** Resolve canonical short org/team URL params into UUID team id for internal routing. */
export async function GET(request: Request) {
  const auth = await getRequestAuth()
  if (!auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  const shortOrgId = url.searchParams.get("shortOrgId")?.trim()
  const shortTeamId = url.searchParams.get("shortTeamId")?.trim()
  if (!shortOrgId || !shortTeamId) {
    return NextResponse.json({ error: "shortOrgId and shortTeamId are required" }, { status: 400 })
  }
  const supabase = getSupabaseServer()
  const [organizationPortalUuid, teamId] = await Promise.all([
    resolveOrganizationPortalUuidFromShortOrgId(supabase, shortOrgId),
    resolveTeamIdFromShortOrgTeamIds(supabase, shortOrgId, shortTeamId),
  ])
  if (!organizationPortalUuid || !teamId) {
    return NextResponse.json({ error: "Route mapping not found" }, { status: 404 })
  }
  return NextResponse.json({ shortOrgId, shortTeamId, organizationPortalUuid, teamId })
}
