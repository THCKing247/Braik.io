import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  buildOrganizationPortalPath,
  resolveDefaultOrganizationPortalUuidForUser,
  resolveDefaultShortOrgIdForUser,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

/** Resolve authenticated user's organization portal base route. */
export async function GET() {
  const auth = await getRequestAuth()
  if (!auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = getSupabaseServer()
  const [organizationPortalUuid, shortOrgId] = await Promise.all([
    resolveDefaultOrganizationPortalUuidForUser(supabase, auth.user.id),
    resolveDefaultShortOrgIdForUser(supabase, auth.user.id),
  ])
  if (!organizationPortalUuid || !shortOrgId) {
    return NextResponse.json({ error: "No organization portal available" }, { status: 404 })
  }
  return NextResponse.json({
    shortOrgId,
    organizationPortalUuid,
    path: buildOrganizationPortalPath(shortOrgId),
  })
}
