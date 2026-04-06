import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { hasPermission } from "@/lib/permissions/platform-permissions"

export const runtime = "nodejs"

/** For admin shell: whether the current user may open Roles & Permissions (manage_roles_permissions or legacy admin). */
export async function GET() {
  const access = await getAdminAccessForApi()
  if (!access.ok) {
    return access.response
  }
  const canManageRoles = await hasPermission(
    access.context.actorId,
    access.context.actorEmail,
    "manage_roles_permissions"
  )
  return NextResponse.json({ canManageRoles })
}
