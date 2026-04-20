import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  buildOrganizationPortalPath,
  resolveDefaultOrganizationPortalUuidForUser,
} from "@/lib/navigation/organization-routes"

export async function resolveCurrentUserOrganizationPortalPath(pagePath = ""): Promise<string | null> {
  const session = await getServerSession()
  const userId = session?.user?.id
  if (!userId) return null
  const organizationPortalUuid = await resolveDefaultOrganizationPortalUuidForUser(getSupabaseServer(), userId)
  if (!organizationPortalUuid) return null
  return buildOrganizationPortalPath(organizationPortalUuid, pagePath)
}
