import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveShortOrgIdForOrganizationPortalUuid } from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

/** Map organization portal UUID (athletic_department id) → short org id for canonical `/org/:shortOrgId` routes. */
export async function GET(request: Request) {
  const auth = await getRequestAuth()
  if (!auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizationPortalUuid = new URL(request.url).searchParams.get("organizationPortalUuid")?.trim()
  if (!organizationPortalUuid) {
    return NextResponse.json({ error: "organizationPortalUuid is required" }, { status: 400 })
  }

  const shortOrgId = await resolveShortOrgIdForOrganizationPortalUuid(getSupabaseServer(), organizationPortalUuid)
  if (!shortOrgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  return NextResponse.json({ shortOrgId })
}
