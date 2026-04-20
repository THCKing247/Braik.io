import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  buildOrganizationPortalPath,
  resolveDefaultShortOrgIdForUser,
} from "@/lib/navigation/organization-routes"

export async function resolveCurrentUserOrganizationPortalPath(pagePath = ""): Promise<string | null> {
  const session = await getServerSession()
  const userId = session?.user?.id
  if (!userId) return null
  const shortOrgId = await resolveDefaultShortOrgIdForUser(getSupabaseServer(), userId)
  if (!shortOrgId) return null
  return buildOrganizationPortalPath(shortOrgId, pagePath)
}
