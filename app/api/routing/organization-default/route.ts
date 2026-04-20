import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  buildOrganizationPortalPath,
  resolveDefaultOrganizationPortalUuidForUser,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

/** Resolve authenticated user's organization portal base route. */
export async function GET() {
  const auth = await getRequestAuth()
  if (!auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const organizationPortalUuid = await resolveDefaultOrganizationPortalUuidForUser(
    getSupabaseServer(),
    auth.user.id
  )
  if (!organizationPortalUuid) {
    return NextResponse.json({ error: "No organization portal available" }, { status: 404 })
  }
  return NextResponse.json({
    organizationPortalUuid,
    path: buildOrganizationPortalPath(organizationPortalUuid),
  })
}
